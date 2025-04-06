// src/server/serverSheet.ts
import { buildCssText } from '../shared/buildCssText';
import { IStyleDefinition } from '../shared/parseStyles.types';

/**
 * คลาสเลียนแบบแนวทาง styled-components:
 * - เก็บ styleDef ผ่าน insertCSSRules (ขณะ SSR)
 * - แปลงทั้งหมดเป็น <style> ผ่าน getStyleTags()
 */
export class ServerStyleSheet {
  private styleDefMap = new Map<string, IStyleDefinition>();
  private themeCSSText: string | null = null;

  /**
   * เก็บข้อมูล style (ระหว่าง SSR) แทนการ insertRule ใน DOM
   */
  public insertCSSRules(displayName: string, styleDef: IStyleDefinition) {
    // ถ้าต้องการ transformVariables บน server ก็ใส่ได้ (หรือให้ client handle ก็ได้)
    this.styleDefMap.set(displayName, styleDef);
  }

  public setThemeCSSText(cssText: string) {
    this.themeCSSText = cssText;
  }

  /**
   * สร้าง <style> รวม CSS ทั้งหมด สำหรับฝังใน HTML ตอน SSR
   */
  public getCSSText(): string {
    let css = '';
    for (const [displayName, styleDef] of this.styleDefMap.entries()) {
      css += buildCssText(displayName, styleDef);
    }
    if (this.themeCSSText) {
      css = this.themeCSSText + css;
    }

    return css;
  }

  /**
   * ล้างค่าใน map กรณีต้องการ reuse sheet instance
   * ตอนนี้ยังไม่ใช้ เพราะ ถ้าใช้แล้ว เวลา refresh next js จะเคลียร์ style ทิ้งจนหมด (ไม่มี cache ไว้)
   */
  // public seal() {
  //   this.styleDefMap.clear();
  //   this.themeCSSText = null;
  // }
}
