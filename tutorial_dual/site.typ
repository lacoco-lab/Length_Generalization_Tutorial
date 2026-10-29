#import "@tola/site:0.0.0": site
#import "@tola/source:0.0.0": all-sources
#import "site/selection.typ": select-pages
#import "site/page.typ": page-template
#import "site/not-found.typ": not-found-template

#set text(
  lang: site.language.lang,
  script: site.language.script,
  region: site.language.region,
)

/// Every page this site publishes: one entry per source, paired with the output file its route
/// names.
#let pages = select-pages(all-sources())

#for page in pages { page-template(page) }

#not-found-template()
