import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AppError } from '../shared/app-error';
import { traceLogger, alertError } from '../shared/logger';
import { TenantContext } from '../tenant/tenant-context';

/**
 * AllExceptionsFilter 全局异常过滤器单测。
 * 覆盖：AppError / HttpException（字符串与对象响应）/ 普通 Error / 未知非 Error 值，
 * httpStatusToCode 全映射、5xx 告警触发（502 豁免）、{ code,msg,data,traceId } 信封输出。
 * 通过 jest.mock('../shared/logger') 隔离真实 pino/env，便于断言日志调用。
 */

jest.mock('../shared/logger', () => ({
  traceLogger: jest.fn(),
  alertError: jest.fn(),
}));

const mockedTraceLogger = traceLogger as unknown as jest.Mock;
const mockedAlertError = alertError as unknown as jest.Mock;

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let request: { url: string };
  let logError: jest.Mock;
  let logWarn: jest.Mock;

  beforeEach(() => {
    logError = jest.fn();
    logWarn = jest.fn();
    mockedTraceLogger.mockReturnValue({ error: logError, warn: logWarn });
    mockedAlertError.mockClear();
    response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    request = { url: '/api/x' };
    filter = new AllExceptionsFilter();
  });

  function host(): ArgumentsHost {
    return {
      switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    } as unknown as ArgumentsHost;
  }

  /** 在 TenantContext 作用域内执行，便于断言 traceId；traceId 缺省时用例外调用测 'unknown' */
  function runWithTrace(exception: unknown, traceId = 't1'): void {
    TenantContext.run({ traceId, tenantId: 't1' }, () => filter.catch(exception, host()));
  }

  describe('AppError', () => {
    it('使用 AppError 自身的 code/httpStatus/message/data 并输出信封', () => {
      const err = new AppError('NOT_FOUND', '资源没了', { id: 1 });
      runWithTrace(err);

      expect(response.json).toHaveBeenCalledWith({
        code: 'NOT_FOUND',
        msg: '资源没了',
        data: { id: 1 },
        traceId: 't1',
      });
      expect(logWarn).toHaveBeenCalled(); // 404 < 500 → warn
      expect(logError).not.toHaveBeenCalled();
      expect(mockedAlertError).not.toHaveBeenCalled(); // 4xx 不告警
    });
  });

  describe('HttpException', () => {
    it('getResponse() 返回字符串：message 取字符串、data 为 null', () => {
      runWithTrace(new HttpException('bad request', HttpStatus.BAD_REQUEST));
      expect(response.json).toHaveBeenCalledWith({
        code: 'INVALID_PARAM',
        msg: 'bad request',
        data: null,
        traceId: 't1',
      });
    });

    it('getResponse() 返回对象含 message+data：提取两者', () => {
      runWithTrace(
        new HttpException({ message: '冲突', data: { field: 'name' } }, HttpStatus.CONFLICT),
      );
      expect(response.json).toHaveBeenCalledWith({
        code: 'CONFLICT',
        msg: '冲突',
        data: { field: 'name' },
        traceId: 't1',
      });
    });

    it('getResponse() 对象无 message：回退 exception.message', () => {
      runWithTrace(new HttpException({ data: [1, 2] }, HttpStatus.FORBIDDEN));
      const payload = response.json.mock.calls[0][0] as {
        code: string;
        msg: string;
        data: unknown;
      };
      expect(payload.code).toBe('FORBIDDEN');
      expect(payload.msg).toBe('Http Exception');
      expect(payload.data).toEqual([1, 2]);
    });

    it('httpStatusToCode 全映射（400/422→INVALID_PARAM；401/403/404/405/409/429/502/503/其它）', () => {
      const cases: Array<[number, string]> = [
        [HttpStatus.BAD_REQUEST, 'INVALID_PARAM'],
        [HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_PARAM'],
        [HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED'],
        [HttpStatus.FORBIDDEN, 'FORBIDDEN'],
        [HttpStatus.NOT_FOUND, 'NOT_FOUND'],
        [HttpStatus.METHOD_NOT_ALLOWED, 'METHOD_NOT_ALLOWED'],
        [HttpStatus.CONFLICT, 'CONFLICT'],
        [HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS'],
        [HttpStatus.BAD_GATEWAY, 'EXTERNAL_SERVICE_ERROR'],
        [HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE'],
        [HttpStatus.NOT_IMPLEMENTED, 'INTERNAL_ERROR'],
      ];
      for (const [status, expectedCode] of cases) {
        mockedTraceLogger.mockClear();
        response.json.mockClear();
        runWithTrace(new HttpException('m', status));
        const payload = response.json.mock.calls[0][0] as { code: string };
        expect(payload.code).toBe(expectedCode);
      }
    });

    it('5xx 触发 alertError；502(EXTERNAL_SERVICE_ERROR) 豁免', () => {
      runWithTrace(new HttpException('gateway down', HttpStatus.BAD_GATEWAY));
      expect(mockedAlertError).not.toHaveBeenCalled();

      runWithTrace(new HttpException('server exploded', HttpStatus.INTERNAL_SERVER_ERROR));
      expect(mockedAlertError).toHaveBeenCalledWith(
        expect.stringContaining('[INTERNAL_ERROR] server exploded'),
      );
    });
  });

  describe('普通 Error / 未知值', () => {
    it('普通 Error：用 message、500、error 级日志并告警', () => {
      const err = new Error('boom');
      runWithTrace(err);

      const payload = response.json.mock.calls[0][0] as {
        code: string;
        msg: string;
        data: unknown;
      };
      expect(payload).toEqual({ code: 'INTERNAL_ERROR', msg: 'boom', data: null, traceId: 't1' });
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INTERNAL_ERROR', status: 500, stack: err.stack }),
        expect.stringContaining('[INTERNAL_ERROR] boom'),
      );
      expect(mockedAlertError).toHaveBeenCalledWith(
        expect.stringContaining('[INTERNAL_ERROR] boom'),
      );
    });

    it('非 Error 未知值（字符串）：回落默认错误信息', () => {
      runWithTrace('oops');
      const payload = response.json.mock.calls[0][0] as { code: string; msg: string };
      expect(payload.code).toBe('INTERNAL_ERROR');
      expect(payload.msg).toBe('服务器内部错误');
    });

    it('undefined 异常：回落默认并告警', () => {
      runWithTrace(undefined);
      const payload = response.json.mock.calls[0][0] as { code: string; msg: string };
      expect(payload.code).toBe('INTERNAL_ERROR');
      expect(payload.msg).toBe('服务器内部错误');
      expect(mockedAlertError).toHaveBeenCalled();
    });
  });

  describe('traceId', () => {
    it('TenantContext 无 traceId 时回退 unknown', () => {
      filter.catch(new Error('no ctx'), host());
      const payload = response.json.mock.calls[0][0] as { traceId: string };
      expect(payload.traceId).toBe('unknown');
    });
  });
});
