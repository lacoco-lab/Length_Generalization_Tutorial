// PDF entry point. The HTML entry point includes the same manuscript.
#set document(title: "Length Generalization in Transformers")
#set page(paper: "a4", margin: (x: 23mm, y: 22mm), numbering: "1")
#set text(font: "Libertinus Serif", size: 11pt, lang: "en")
#set par(justify: true, leading: 0.65em)
#set heading(numbering: "1.1")
#show heading.where(level: 4): set heading(numbering: none)
#set table(inset: 5pt, stroke: 0.4pt + luma(200))
#show table: it => block(breakable: false, it)
#align(center)[#text(size: 23pt, weight: "bold")[Length Generalization in Transformers]]
#v(1em)
#outline(title: [Contents], depth: 2)
#pagebreak()
#include "tutorial_dual/manuscript.typ"
