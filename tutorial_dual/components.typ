#let c-rasp-editor-url = "https://github.com/lacoco-lab/Length_Generalization_Tutorial/tree/blog/interactive-tutorial/site/version2"

// Shared authoring helpers: HTML folds details; PDF always includes the full text.
#let details(title, body) = context {
  if target() == "html" {
    html.elem("details", attrs: (class: "explanation"))[
      #html.elem("summary", title)
      #html.elem("div", attrs: (class: "explanation-body"), body)
    ]
  } else {
    block(
      width: 100%,
      above: 0.9em,
      below: 1em,
      inset: 10pt,
      fill: rgb("f1f6f3"),
      stroke: 0.6pt + rgb("c5d7cd"),
      radius: 4pt,
      breakable: true,
    )[
      #block(below: 0.5em, sticky: true)[
        #text(fill: rgb("17635e"), weight: "bold", title)
      ]
      #body
    ]
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
    [*Try it yourself.* The #link(c-rasp-editor-url)[drag-and-drop C-RASP editor (source and launch instructions)] lets you build programs and inspect their values on sample inputs. It evaluates C-RASP programs; compilation into transformer weights is the separate construction discussed below.]
  }
}

// A visible explanatory box in both output modes.
#let notation-box(body) = context {
  if target() == "html" {
    html.elem("aside", attrs: (class: "notation-box", "aria-label": "Semantics of prefix counting"), body)
  } else {
    block(width: 100%, inset: 10pt, stroke: 0.6pt + luma(190),
      fill: luma(248), radius: 4pt, breakable: false, body)
  }
}

// Keep the operation reference spacious in print without changing the HTML tables.
#let operation-table(..cells) = context {
  if target() == "html" {
    table(columns: (auto, 1fr), row-gutter: 0pt, ..cells.pos())
  } else {
    set text(size: 9.5pt)
    set par(justify: false)
    table(columns: (0.85fr, 2fr), row-gutter: 0pt, inset: (x: 6pt, y: 10pt),
      align: left + horizon, stroke: 0.5pt + luma(205), ..cells.pos())
  }
}
