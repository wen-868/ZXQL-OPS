import { v4 as uuid } from "uuid";

export function ok<T>(data?: T) {
  return { code: "0", msg: "成功", data, traceId: uuid() };
}

export function fail(msg: string, code = "400") {
  return { code, msg, traceId: uuid() };
}