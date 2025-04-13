## แก้ไข logic การ hash ต่อไปนี้ใช้แค่ class name + scope + $variable name + val / --&localVar name + val ก็พอแล้ว


ฉันขอสอบถามเพิ่มเติมหน่อยว่า เราควรมี @scope hash ไหม ในเมื่อเรามี @scope <scope-name> ไว้แล้ว
คืออันนี้ที่ถามก่อนเพราะ


-- theme.class`
.. สร้าง global class name พร้อมใช้กับ @bind ได้ทุกที่
- @bind ต่อไปนี้จะไม่ถูกนำไปอยู่ข้างบนสุดของ css`` อีกต่อไป มันจะถูกใช้งานแบบนี้แทน

@bind wrap .box .highlight <-- เมื่อ format มันจะถูกนำมาอยู่ข้างบนของ class ที่มีการใช้งานมันก่อน case นี้ คือ .box
.box {
    bg[red]
}
`