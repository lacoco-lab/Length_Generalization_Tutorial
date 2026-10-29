// Shared authoring helpers: HTML folds details; PDF always includes the full text.
#let details(title, body) = context {
  if target() == "html" {
    html.elem("details", attrs: (class: "explanation"))[
      #html.elem("summary", title)
      #html.elem("div", attrs: (class: "explanation-body"), body)
    ]
  } else {
    block(above: 0.9em, below: 0.5em, sticky: true)[#strong(title)]
    body
  }
}

#let operation-columns(..columns) = context {
  if target() == "html" {
    html.elem("div", attrs: (class: "operation-columns"))[
      #for column in columns.pos() { html.elem("div", column) }
    ]
  } else {
    grid(columns: (1fr, 1fr), gutter: 1em, ..columns.pos())
  }
}

#let interactive-notebook() = context {
  if target() == "html" {
    html.elem("section", attrs: (class: "interactive", "aria-label": "Explore the Dyck-1 program"))[
      #heading(level: 3)[Try the Dyck-1 program]
      Use the token sandbox to change `()(())` to `())(` and inspect the first prefix violation.
      Then try the block builder or repair a rule.

      #html.elem("p", attrs: (class: "small"))[
        The notebook labels positions starting at 0; the equations above start at 1.
        It evaluates a small typed C-RASP subset in your browser.
      ]
      // Relative assets keep this page portable under a hosting subdirectory.
      #html.elem("iframe", attrs: (
        src: "assets/interactive/notebook.html",
        title: "Interactive C-RASP walkthrough and block builder",
        loading: "lazy",
        class: "notebook-frame",
        height: "1100",
      ))[]
      #html.elem("p")[
        #link("assets/interactive/notebook.html")[Open the notebook on its own]
        #linebreak()
        #link("https://github.com/lacoco-lab/Length_Generalization_Tutorial/tree/blog/interactive-tutorial")[Interactive tutorial source]
      ]
    ]
  } else {
    block(inset: 10pt, stroke: 0.5pt + luma(190), radius: 3pt)[
      *Exercise: inspect a prefix violation.* Compare `()(())` with `())(`.
      For `())(`, compute the opening and closing counts at position 3 and explain
      why equal final counts do not imply acceptance.

      The HTML edition includes an interactive walkthrough and block builder here.
      #link("https://github.com/lacoco-lab/Length_Generalization_Tutorial/tree/blog/interactive-tutorial")[Interactive tutorial source.]
    ]
  }
}
