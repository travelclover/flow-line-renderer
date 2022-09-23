/*
 * @Description: 类型描述文件
 * @Author: travelclover(travelclover@163.com)
 * @Date: 2022-09-23 10:09:03
 */
export default class FlowLineRenderer {
  view: __esri.SceneView;
  line: __esri.Polyline;

  constructor(view: __esri.SceneView, line: __esri.Polyline, config?: any);

  /**
   * 更新线
   * @param line 新的线对象
   */
  updateLine(line: __esri.Polyline): void;
}
