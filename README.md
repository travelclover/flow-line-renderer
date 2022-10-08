# flow-line-renderer
A external renderer for ArcGIS JS API， used to show the flow effect of lines.

![流线效果图](https://travelclover.github.io/img/2022/10/路径流线效果.gif)

## 安装
使用npm：
```
$ npm install flow-line-renderer
```
使用yarn：
```
$ yarn add flow-line-renderer
```
使用pnpm：
```
$ pnpm add flow-line-renderer
```

## 示例
使用时，需引入ArcGIS API中的`externalRenderers`对象：
```javascript
import * as externalRenderers from '@arcgis/core/views/3d/externalRenderers';
```
以及引入`flow-line-renderer`：
```javascript
import FlowLineRenderer from 'flow-line-renderer';
```

创建线：
```javascript
const paths = [
  // 第一条路径
  [ 
    [-97.06138, 32.837, 10],
    [-97.06133, 32.836, 10],
    [-97.06124, 32.834, 10]
  ], 
  // 第二条路径
  [ 
    [-97.06326, 32.759, 10],
    [-97.06298, 32.755, 10]
  ]
];
const line = new Polyline({
  paths: paths,
  spatialReference: { wkid: 4326 }
})
```

线条流动效果相关配置：
```javascript
{
  color: '#00ffff', // 线条颜色
  density: 3,
  flowRatio: 0.1,
  speed: 1000,
  width: 3,
}
```

实例化对象：
```javascript
const renderer = new FlowLineRenderer(
  externalRenderers,
  sceneView, // 创建的三维场景对象
  line, // 创建的线几何形状
  config, // 线条流动效果相关配置
)
```

## config相关属性
| 属性 | 类型 | 描述 | 
| :---- | :---- | :---- | 
| color | string \| string[] | 十六进制表示的颜色值。类型为数组时，按顺序一一对应`Polyline`中每条路径的颜色值。 | 
| density | number | 点密度，在地图缩放层级较大的情况下，该值越大，越呈现出一条连续的线。默认值为3. | 
| flowRatio | number \| number[] | 流动效果长度占流动路径长度的比例，取值范围大于0并且小于1。类型为数组时，按顺序一一对应`Polyline`中每条路径的流动长度比例。 | 
| speed | number \| number[] | 流动速度，默认值为500。类型为数组时，按顺序一一对应`Polyline`中每条路径的流动速度。 | 
| width | number \| number[] | 线条宽度。默认值为3。 | 

## 实例方法
| 方法名称 | 返回值类型 | 描述   | 
| :---- | :---- | :---- | 
| updateLine(line: __esri.Polyline) | undefind | 更新几何线段，重新设置线条路径。 |

### updateLine()
```javascript
const line2 = new Polyline(lineOptions);
renderer.updateLine(line2);
```
