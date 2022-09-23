/*
 * @Description: 类型描述文件
 * @Author: travelclover(travelclover@163.com)
 * @Date: 2022-09-23 10:09:03
 */
export interface Config {
  /** 线条颜色，十六进制颜色值 */
  color?: string | string[];
  /** 流动效果长度占流动路径长度的比例，取值范围大于0并且小于1。 */
  flowRatio?: number | number[];
  /** 流动速度 */
  speed?: number | number[];
  /** 点密度，在地图缩放层级较大的情况下，该值越大，越呈现出一条连续的线 */
  density?: number;
}

export default class FlowLineRenderer {
  view: __esri.SceneView;
  line: __esri.Polyline;

  constructor(
    externalRenderers: __esri.externalRenderers,
    view: __esri.SceneView,
    line: __esri.Polyline,
    config?: Config
  );

  /**
   * 更新线
   * @param line 新的线对象
   */
  updateLine(line: __esri.Polyline): void;
}
