/*
 * @Description: 展示线条流动效果的渲染器
 * @Author: travelclover(travelclover@163.com)
 * @Date: 2022-09-21 16:00:25
 */
import * as glMatrix from 'gl-matrix';
import * as externalRenderers from '@arcgis/core/views/3d/externalRenderers';
import { hexToRgb } from './utils';

const shaderStr = {
  // 片段着色器
  fs: `
    precision mediump float;
    varying vec4 vFragColor;
    void main(void) {
      gl_FragColor = vec4(vFragColor);
    }
  `,
  // 顶点着色器
  vs: `
    attribute vec3 aVertexPosition;
    attribute vec4 aColor;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uModelViewMatrix;
    varying vec4 vFragColor;
    void main(void) {
      gl_PointSize = 3.0;
      gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
      vFragColor = aColor;
    }
  `,
};

class FlowLineRenderer {
  time: number; // 时间，用于动画
  defaultColor = [0, 255, 255]; // 默认颜色
  colorsArr: number[][] = []; // 线条颜色数组
  defaultFlowRatio = 0.05; // 流动效果长度占流动路径长度的比例
  flowRatioArr: number[] = []; //
  defaultSpeed = 500; // 流动速度
  speedArr: number[] = [];
  defaultDensity = 3; // 点密度, 在地图层级放大的情况下，可能需要曾大该值
  linesActiveIndex: number[] = []; // 每条线运动的索引值
  view: __esri.SceneView;
  line: __esri.Polyline;
  linesToRender: number[][][] = [];
  glPointSize = 3; // 点着色器中的点大小
  localOriginRender: [number, number, number] = [0, 0, 0]; // 渲染坐标系中的原点坐标
  program: WebGLProgram | null = null; // webgl程序
  programAttributeVertexPosition: number = 0; // 顶点变量位置索引
  programAttributeColor: number = 0; // 颜色索引
  programUniformProjectionMatrix: WebGLUniformLocation | null = null; // 投影矩阵索引
  programUniformModelViewMatrix: WebGLUniformLocation | null = null; // 模型视图矩阵索引
  vboPositions: WebGLBuffer | null = null; // 顶点数据缓冲区
  iboPositions: WebGLBuffer | null = null; // 顶点索引数据缓冲区

  tempMatrix4 = new Float32Array(16); // 临时4阶矩阵变量

  constructor(view: __esri.SceneView, line: __esri.Polyline, config = {}) {
    this.view = view;
    this.line = line;
    this.time = new Date().getTime();
    this.updateConfig(config);
  }

  updateLine(line: __esri.Polyline) {
    this.line = line;
    this.initData(); // 更新线后初始化数据
  }

  updateConfig(config: any) {
    const { color, flowRatio, speed, density } = config;
    if (typeof color === 'string') {
      this.defaultColor = hexToRgb(color);
    } else if (Array.isArray(color)) {
      this.colorsArr = color.map((item) => hexToRgb(item));
    }
    if (!flowRatio || typeof flowRatio === 'number') {
      this.defaultFlowRatio = flowRatio || 0.05;
    } else if (Array.isArray(flowRatio)) {
      this.flowRatioArr = flowRatio;
    }
    if (!speed || typeof speed === 'number') {
      this.defaultSpeed = speed || 500;
    } else if (Array.isArray(speed)) {
      this.speedArr = speed;
    }
    this.defaultDensity = density || 3;
  }

  setup(context: __esri.RenderContext) {
    const gl = context.gl;
    this.initShaders(context); // 初始化着色器
    this.initData(); // 初始化数据

    // cleanup
    context.resetWebGLState();
  }

  render(context: __esri.RenderContext) {
    const gl = context.gl;
    const now = new Date().getTime();
    const timeDelta = now - this.time;
    this.time = now;

    gl.disable(gl.DEPTH_TEST); // 关闭深度比较
    gl.enable(gl.CULL_FACE); // 多边形剔除
    // gl.disable(gl.BLEND); // 关闭计算的片段颜色值的混合
    gl.enable(gl.BLEND); // 开启计算的片段颜色值的混合
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // 渲染管线α融合功能单元配置

    gl.useProgram(this.program);
    this.setCommonUniforms(context);

    // 生成buffer
    const bufferArray: number[] = [];
    for (let i = 0; i < this.linesToRender.length; i++) {
      const line = this.linesToRender[i];
      let flowRatio = this.flowRatioArr[i] || this.defaultFlowRatio;
      let speed = this.speedArr[i] || this.defaultSpeed;
      // 计算需要显示的点数量
      let highlightNum = line.length * flowRatio;
      if (highlightNum < 2) highlightNum = 2;
      this.linesActiveIndex[i] =
        (this.linesActiveIndex[i] + (speed * timeDelta) / 1000) % line.length;
      let points: number[][] = [];
      if (this.linesActiveIndex[i] < highlightNum) {
        points = [
          ...line.slice(
            line.length - (highlightNum - this.linesActiveIndex[i])
          ),
          ...line.slice(0, this.linesActiveIndex[i]),
        ];
      } else {
        points = line.slice(
          this.linesActiveIndex[i] - highlightNum,
          this.linesActiveIndex[i]
        );
      }
      // 获取颜色
      let color = this.colorsArr[i] || this.defaultColor;
      for (let j = 0; j < points.length; j++) {
        const point: number[] = points[j];
        const colorAlpha = Math.pow((j + 1) / points.length, 3);
        bufferArray.push(point[0]);
        bufferArray.push(point[1]);
        bufferArray.push(point[2]);
        bufferArray.push(color[0] / 255);
        bufferArray.push(color[1] / 255);
        bufferArray.push(color[2] / 255);
        bufferArray.push(colorAlpha);
      }
    }
    this.vboPositions = this.createVertexBuffer(gl, bufferArray);
    this.iboPositions = this.createIndexBuffer(
      gl,
      new Uint16Array(
        new Array(bufferArray.length / 7).fill(1).map((n, i) => i)
      )
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboPositions);
    gl.enableVertexAttribArray(this.programAttributeVertexPosition);
    gl.vertexAttribPointer(
      this.programAttributeVertexPosition,
      3,
      gl.FLOAT,
      false,
      7 * 4,
      0
    );

    gl.enableVertexAttribArray(this.programAttributeColor);
    gl.vertexAttribPointer(
      this.programAttributeColor,
      4,
      gl.FLOAT,
      false,
      7 * 4,
      3 * 4
    );

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iboPositions);

    glMatrix.mat4.identity(this.tempMatrix4); // 将this.tempMatrix4设置为单位矩阵
    // 通过将视图矩阵平移到局部原点来应用局部原点，这将把视图原点(0,0,0)放到局部原点
    glMatrix.mat4.translate(
      this.tempMatrix4, // 用于接收结果的矩阵
      this.tempMatrix4, // 要平移的矩阵
      this.localOriginRender // 要平移的向量
    );
    // 矩阵相乘
    glMatrix.mat4.multiply(
      this.tempMatrix4,
      context.camera.viewMatrix as any,
      this.tempMatrix4
    );
    // 设置统一变量数据
    gl.uniformMatrix4fv(
      this.programUniformModelViewMatrix,
      false,
      this.tempMatrix4
    );

    gl.drawElements(
      // gl.TRIANGLES, // 指定要渲染的类型
      gl.POINTS, // 指定要渲染的类型
      bufferArray.length / 7, // 指定要渲染的绑定元素数组缓冲区的元素数
      gl.UNSIGNED_SHORT, // 指定元素数组缓冲区中的值的类型
      0 // 指定元素数组缓冲区中的字节偏移量。必须是给定类型大小的有效倍数
    );

    // 一直绘制
    externalRenderers.requestRender(this.view);

    // cleanup
    context.resetWebGLState();
  }

  // 初始化着色器
  initShaders(context: __esri.RenderContext) {
    const gl = context.gl;
    const fragmentShader = this.getShader(gl, 'fs'); // 获取片元着色器
    const vertexShader = this.getShader(gl, 'vs'); // 获取顶点着色器
    this.program = this.linkProgram(
      gl,
      fragmentShader as WebGLShader,
      vertexShader as WebGLShader
    ); // 链接给定的WebGLProgram，从而完成为程序的片元和顶点着色器准备 GPU 代码的过程
    gl.useProgram(this.program); // 将定义好的WebGLProgram 对象添加到当前的渲染状态中

    this.programAttributeVertexPosition = gl.getAttribLocation(
      this.program as WebGLProgram,
      'aVertexPosition'
    );
    gl.enableVertexAttribArray(this.programAttributeVertexPosition); // 通过传入索引来激活顶点属性
    // 颜色
    this.programAttributeColor = gl.getAttribLocation(
      this.program as WebGLProgram,
      'aColor'
    );

    // 通过统一变量的名称获取变量的位置
    // 投影矩阵
    this.programUniformProjectionMatrix = gl.getUniformLocation(
      this.program as WebGLProgram,
      'uProjectionMatrix'
    );
    // 模型视图矩阵
    this.programUniformModelViewMatrix = gl.getUniformLocation(
      this.program as WebGLProgram,
      'uModelViewMatrix'
    );
  }

  // 初始化数据
  initData() {
    // 设置一个局部原点
    const center = this.line.extent?.center || { x: 0, y: 0 };
    const localOriginSR = this.line.spatialReference; // 局部原点空间参考
    const localOrigin = [center.x, center.y, 0]; // 局部原点坐标
    // 在渲染坐标中以32位精度计算局部原点
    this.localOriginRender = (externalRenderers.toRenderCoordinates(
      this.view, // sceneView
      localOrigin, // 坐标
      0, // 开始读取坐标的索引
      localOriginSR, // 空间参考
      new Float64Array(3) as any, // 对将写入结果的数组的引用
      0, // 将开始写入坐标的索引
      1 // 要变换的顶点数
    ) as [number, number, number]) || [0, 0, 0];

    const lineNum = this.line.paths.length;
    const linesToRender: any = []; // 多条线转换后的坐标数组
    for (let i = 0; i < lineNum; i++) {
      let line = this.line.paths[i];
      const pointsToRender: any = []; // 每条线段中的点转换成渲染坐标
      const lineToRender: any = []; // 每条线所有转换后的点坐标,包含插值点
      for (let j = 0; j < line.length; j++) {
        // 从输入坐标到渲染坐标的转换
        const point = line[j];
        // 生成变换矩阵,其中下标为12,13,14的元素分别为变换后点的[x, y, z]坐标值
        const pointToRenderMat4 = externalRenderers.renderCoordinateTransformAt(
          this.view,
          point,
          localOriginSR,
          new Float64Array(16) as any
        );
        const pointToRender = [
          pointToRenderMat4[12],
          pointToRenderMat4[13],
          pointToRenderMat4[14],
        ];
        // 减去局部原点坐标
        glMatrix.vec3.subtract(
          pointToRender as any,
          pointToRender as any,
          this.localOriginRender
        );

        // 从第二个点开始与前一个点进行插值
        if (j > 0) {
          // 计算两个点之间的长度,向量计算
          const length = glMatrix.vec3.length(
            glMatrix.vec3.subtract(
              new Float64Array(3) as any,
              pointsToRender[j - 1] as any,
              pointToRender as any
            )
          );
          // 计算两个点之间需要插值的数量
          const interpolationNumber = length * this.defaultDensity - 2; //
          for (let k = 0; k < interpolationNumber; k++) {
            const tempVec3 = new Float64Array(3);
            glMatrix.vec3.lerp(
              tempVec3 as any,
              pointsToRender[j - 1] as any,
              pointToRender as any,
              (k + 1) / (interpolationNumber + 1)
            );
            lineToRender.push(tempVec3);
          }
        }
        pointsToRender.push(pointToRender);
        lineToRender.push(pointToRender);
      }
      linesToRender.push(lineToRender);
      this.linesActiveIndex[i] = 0; // 重置运动索引标记
    }
    this.linesToRender = linesToRender as number[][][];
  }

  setCommonUniforms(context: __esri.RenderContext) {
    const gl = context.gl;
    const camera = context.camera;

    gl.uniformMatrix4fv(
      this.programUniformProjectionMatrix, // 要设置的统一变量的位置，通过 gl.getUniformLocation()方法获取位置
      false, // 是否转置矩阵，只能是false
      camera.projectionMatrix as any // 要设置的矩阵值
    );
  }

  // 从<script>中加载着色器
  getShader(gl: WebGLRenderingContext, type: 'fs' | 'vs') {
    let str = shaderStr[type];

    let shader;
    if (type === 'fs') {
      // 片元着色器
      shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (type === 'vs') {
      // 顶点着色器
      shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
      return null;
    }

    if (shader) {
      gl.shaderSource(shader, str); // 设置着色器源代码
      gl.compileShader(shader); // 将着色器编译为二进制数据
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
      }
    }

    return shader;
  }

  linkProgram(
    gl: WebGLRenderingContext,
    fragmentShader: WebGLShader,
    vertexShader: WebGLShader
  ) {
    // 创建并初始化一个 WebGLProgram 对象
    const shaderProgram = gl.createProgram();

    if (shaderProgram) {
      // 将片段或顶点着色器 附加到 WebGLProgram
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      // 链接给定的 WebGLProgram
      gl.linkProgram(shaderProgram);

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        return null;
      }
    }

    return shaderProgram;
  }

  // 创建顶点缓冲区
  createVertexBuffer(gl: WebGLRenderingContext, data: number[]) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const float32Data = new Float32Array(data);
    gl.bufferData(gl.ARRAY_BUFFER, float32Data, gl.STATIC_DRAW);
    return buffer;
  }

  // 创建索引缓冲区
  createIndexBuffer(gl: WebGLRenderingContext, data: BufferSource) {
    const buffer = gl.createBuffer(); // 创建并初始化一个缓冲区
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer); // 将缓冲区绑定到用于元素索引的缓冲区
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW); // 初始化并创建缓冲区对象的数据存储
    return buffer;
  }
}

export default FlowLineRenderer;
