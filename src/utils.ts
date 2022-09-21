/*
 * @Description: 工具方法
 * @Author: dengdong(dengd@geoscene.cn)
 * @Date: 2022-09-21 16:43:03
 */

/**
 * 十六进制颜色转rgba颜色
 * @param color 十六进制颜色值
 * @returns 返回[r, g, b]数组
 */
export function hexToRgb(color: string) {
  const str = '0x' + color.substring(1, color.length);
  const b = (str as any) & 0x0000ff;
  const g = ((str as any) & 0x00ff00) >> 8;
  const r = ((str as any) & 0xff0000) >> 16;
  return [r, g, b];
}
