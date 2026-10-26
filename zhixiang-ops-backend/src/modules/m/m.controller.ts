import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { DashboardService } from './m.service';
import { CreateDashboardDto, UpdateDashboardDto } from './dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 鍐崇瓥浠〃鐩樹笌 BI 鎺у埗鍣紙瑙勫垝 搂4-M / 寮€鍙戦『搴?M 浠〃鐩樹笌 BI锛夈€?
 * 璺敱鍓嶇紑 ops锛堝叏灞€鍓嶇紑 api 鈫?/api/ops/*锛夈€傜粺涓€ BI 鑱氬悎灞傦細鏍稿績鎸囨爣鍗?瓒嬪娍銆佸叏閾捐矾婕忔枟銆?
 * 璐﹀彿瀵规瘮銆侀€夐鏁堣兘姒溿€佷汉鎬ч挬瀛愬垎鏋愩€佷华琛ㄧ洏閰嶇疆 CRUD銆傜鎴烽殧绂荤敱鏈嶅姟灞傚己绾︽潫銆?
 * 娉細鍘?J(recycle) 鎺у埗鍣ㄧ殑 /dashboard/overview銆?dashboard/driver-efficiency 宸茶縼鑷虫锛堥伩鍏嶈矾鐢卞啿绐侊級銆?
 * 鍙鑱氬悎鎺ュ彛闇€鐧诲綍锛堢鎴峰彇鑷?JWT 涓殑 tenantId锛夛紝閰嶇疆 CRUD 淇濇寔閴存潈銆?
 */
@ApiTags('ops')
@Controller('ops')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** GET /api/ops/dashboard/overview 鈥?鏍稿績鎸囨爣鍗?+ 瓒嬪娍锛堜簲缁村洓鐜囷紝澶嶇敤 J锛?*/
  @Get('dashboard/overview')
  @ApiOperation({
    summary: 'GET /api/ops/dashboard/overview 鈥?鏍稿績鎸囨爣鍗?+ 瓒嬪娍锛堜簲缁村洓鐜囷紝澶嶇敤 ',
  })
  getOverview() {
    return this.dashboardService.getOverview();
  }

  /** GET /api/ops/dashboard/funnel 鈥?鍏ㄩ摼璺紡鏂楋紙鍐呭鐢熶骇鐜団啋鍒嗗彂瑕嗙洊鈫掕Е杈锯啋浜掑姩鈫掕浆鍖栤啋鏀剁泭锛?*/
  @Get('dashboard/funnel')
  @ApiOperation({
    summary:
      'GET /api/ops/dashboard/funnel 鈥?鍏ㄩ摼璺紡鏂楋紙鍐呭鐢熶骇鐜団啋鍒嗗彂瑕嗙洊鈫掕Е杈',
  })
  getFunnel() {
    return this.dashboardService.getFunnel();
  }

  /** GET /api/ops/dashboard/account-compare 鈥?璐﹀彿瀵规瘮 */
  @Get('dashboard/account-compare')
  @ApiOperation({ summary: 'compare 鈥?璐﹀彿瀵规瘮 */' })
  getAccountCompare() {
    return this.dashboardService.getAccountCompare();
  }

  /** GET /api/ops/dashboard/topic-efficiency 鈥?閫夐鏁堣兘姒?*/
  @Get('dashboard/topic-efficiency')
  @ApiOperation({ summary: 'efficiency 鈥?閫夐鏁堣兘姒?*/' })
  getTopicEfficiency() {
    return this.dashboardService.getTopicEfficiency();
  }

  /** GET /api/ops/dashboard/human-hook 鈥?浜烘€ч挬瀛愬垎鏋愶紙7脳6锛屽鐢?J 浜烘€ф晥鑳斤級 */
  @Get('dashboard/human-hook')
  @ApiOperation({ summary: 'hook 鈥?浜烘€ч挬瀛愬垎鏋愶紙7脳6锛屽鐢?J 浜烘€ф晥鑳斤級 */' })
  getHumanHook() {
    return this.dashboardService.getHumanHook();
  }

  /** GET /api/ops/dashboards 鈥?浠〃鐩橀厤缃垪琛?*/
  @Get('dashboards')
  @ApiOperation({ summary: 'GET /api/ops/dashboards 鈥?浠〃鐩橀厤缃垪琛?*/' })
  listDashboards() {
    return this.dashboardService.listDashboards();
  }

  /** POST /api/ops/dashboards 鈥?鏂板缓浠〃鐩橀厤缃?*/
  @Post('dashboards')
  @ApiOperation({ summary: 'POST /api/ops/dashboards 鈥?鏂板缓浠〃鐩橀厤缃?*/' })
  createDashboard(@Body() dto: CreateDashboardDto) {
    return this.dashboardService.createDashboard(dto);
  }

  /** GET /api/ops/dashboards/:id 鈥?浠〃鐩橀厤缃鎯?*/
  @Get('dashboards/:id')
  @ApiOperation({ summary: 'GET /api/ops/dashboards/:id 鈥?浠〃鐩橀厤缃鎯?*/' })
  getDashboard(@Param('id') id: string) {
    return this.dashboardService.getDashboard(Number(id));
  }

  /** PUT /api/ops/dashboards/:id 鈥?鏇存柊浠〃鐩橀厤缃?*/
  @Put('dashboards/:id')
  @ApiOperation({ summary: 'PUT /api/ops/dashboards/:id 鈥?鏇存柊浠〃鐩橀厤缃?*/' })
  updateDashboard(@Param('id') id: string, @Body() dto: UpdateDashboardDto) {
    return this.dashboardService.updateDashboard(Number(id), dto);
  }

  /** DELETE /api/ops/dashboards/:id 鈥?鍒犻櫎浠〃鐩橀厤缃紙杞垹锛?*/
  @Delete('dashboards/:id')
  @ApiOperation({ summary: 'DELETE /api/ops/dashboards/:id 鈥?鍒犻櫎浠〃鐩橀厤缃紙杞垹锛?*/' })
  deleteDashboard(@Param('id') id: string) {
    return this.dashboardService.deleteDashboard(Number(id));
  }
}
