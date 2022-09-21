/*
 * @Description: webpack配置文件
 * @Author: travelclover(travelclover@163.com)
 * @Date: 2022-09-21 16:13:07
 */

const path = require('path');

function resolve(dir) {
  return path.resolve(__dirname, dir);
}

module.exports = {
  entry: './src/index.ts',
  output: {
    clean: true,
    path: resolve('dist'),
    filename: 'index.min.js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        include: [resolve('src')],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'], //针对于'.ts', '.js'这三种文件进行处理引入文件可以不写他的扩展名
  },
};
