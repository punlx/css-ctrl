**release 1**: general use (abbr style in .css.ts, extension ex. generator and intellisense)

---

**release 2**: new features @scope, @mix, @bind

```tsx
export const appCss = styled<{ box: [] }>`
	@scope app // done

	.box {
		@use boxd // <--todo
		bg[#f00]
		c[#fff]
		hover(bg[#0f0] c[#000])
	}
	
	
	@bind boxAll .box // <-- in progress
	@mix boxd .box5 .box6 // <- todo
`;
```

---

จุดที่อาจปรับปรุง (Potential Improvements)

1. การจัดการ State ระหว่าง SSR → Client

- ปัจจุบัน SSR จะสร้าง CSS ทั้งหมดใน <style> ของเซิร์ฟเวอร์ จากนั้น Client ก็ parse ซ้ำและ insert DOM.
- บางทีอาจ optimize ให้ Client reuse ข้อมูลจาก SSR (hydratation) เพื่อเลี่ยง re-parse. (แต่ต้องการค่าที่ serialize ออกมาให้ Client อ่านได้ง่าย)

2. การทำงานร่วมกับ HMR (Hot Module Replacement)

- ปัจจุบันมี warning ถ้ามีการใช้ scope ซ้ำ หรือ className ซ้ำ. ถ้าใน dev mode HMR reload แล้ว scope เดิมจะชน. อาจต้องทำ Mechanism “ลบของเก่า” หรือ rename scope ใหม่เมื่อ HMR

3. ยุบรวมระบบ flush

- มีทั้ง flushPendingStyles() ของ insertCSSRules, และ flushVars() ของ styledVars. ถ้าอยากโฟกัสเรื่อง performance + predictability อาจรวม logic เป็น “single scheduler” ตัวเดียว หรือใช้ requestIdleCallback หรือใช้ queue microtask ฯลฯ ขึ้นกับแนวทาง

4. ขนาด DSL และ Syntax

- ตอนนี้ DSL เติบโตเร็วมาก (มี @use, @const, @bind, @scope, screen(...), container(...), before(...), after(...), …) จำเป็นต้องทดสอบ edge case ให้ครอบคลุม
- ถ้าต้องเพิ่ม directive ใหม่ อาจต้องระวังการซ้อน block (Syntax complexity)

5. การ Merge styleDef

- ฟังก์ชัน mergeStyleDef ค่อนข้างยาว แนะนำอาจแยกเป็น utility ย่อย หรือจัดโครงสร้างให้อ่านง่ายขึ้น

6. Error Handling / Debug

- มีการ throw error หลายจุด (เช่น parse ผิด, duplicate scope ฯลฯ) → ดีแล้วที่บอกข้อความชัดเจน
  บางทีอาจอยากมี “warning mode” ไม่ต้อง throw เสมอ (ถ้า dev vs prod)

7. การทำ Memo / Cache

- ทุกครั้งที่ parse, transform variable → อาจมี overhead. ถ้าเจอ use case ขนาดใหญ่ (หลายพัน style) อาจต้องใช้ cache ที่ robust กว่า

8. TypeScript Type

- ส่วนใหญ่โอเคแล้ว แต่ในบางจุดอาจเสริม type ให้เข้มขึ้น เช่น type ของ return หรือ generic interface ของ styled ที่ map property

9. การรองรับ Nested CSS หรือ @supports

- ตอนนี้ยังไม่มีใน DSL. ถ้าอยากรองรับในอนาคต อาจต้องออกแบบ syntax สำหรับ @supports หรือ nested queries
