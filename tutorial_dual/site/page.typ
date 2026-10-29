#import "@tola/site:0.0.0": site
#import "@tola/address:0.0.0": asset-url
#import "@tola/document:0.0.0": headings

#let page-template(page) = {
  let meta = page.source.meta
  document(page.output, format: "html", title: meta.title, description: meta.description)[
    #html.html(lang: "en")[
      #html.head[
        #html.elem("meta", attrs: (charset: "utf-8"))
        #html.elem("meta", attrs: (name: "viewport", content: "width=device-width, initial-scale=1"))
        #html.link(rel: "stylesheet", href: asset-url("/assets/css/article.css"))
        #html.elem("script", attrs: (src: asset-url("/assets/scripts/article.js"), defer: ""))[]
      ]
      #html.body[
        #html.elem("a", attrs: (href: "#article", class: "skip"))[Skip to article]
        #html.elem("header", attrs: (class: "masthead"))[
          #html.elem("p", attrs: (class: "eyebrow"))[A tutorial · C-RASP and transformers]
          #html.elem("h1", meta.title)
          #html.elem("p", attrs: (class: "deck"))[From prefix counting to computations that work on inputs longer than the training examples.]
          #html.elem("div", attrs: (class: "reading-tools", hidden: "", id: "reading-tools"))[
            #html.elem("button", attrs: (type: "button", id: "expand-details"))[Expand all explanations]
            #html.elem("button", attrs: (type: "button", id: "collapse-details"))[Collapse all explanations]
          ]
          #html.elem("p", attrs: (class: "small"))[Read straight through, or open the detailed explanations as needed.]
        ]
        #html.elem("div", attrs: (class: "layout"))[
          #html.elem("nav", attrs: (class: "contents", "aria-label": "Contents"))[
            #html.elem("strong")[Contents]
            #context {
              for section in headings(depth: 2).filter(section => section.outlined) {
                html.elem("p", attrs: (class: "toc-level-" + str(section.level)))[#link(section.location, section.body)]
              }
            }
          ]
          #html.elem("main", attrs: (id: "article"))[
            #set heading(numbering: none)
            // Scroll the HTML wrapper, preserving the browser's native MathML layout.
            #show math.equation.where(block: true): it => html.elem("div", attrs: (class: "display-equation"), it)
            // Main title is h1; native section headings begin at h2.
            #show heading: it => html.elem("h" + str(calc.min(it.level + 1, 6)), it.body)
            #include page.source.file
          ]
        ]
      ]
    ]
  ]
}
