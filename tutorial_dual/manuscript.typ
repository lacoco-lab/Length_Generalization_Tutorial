#import "components.typ": details, operation-columns, interactive-notebook

= Motivation
- What is length generalization?
- Three different questions
  - Representability: can a transformer compute the function?
  - Learnability: can training learn the function on the training distribution?
  - Length-generalizable learnability: does training on bounded lengths yield a solution that extrapolates to longer inputs?
  - Why these questions should be separated
- Why should we care?
- Why is it hard?
- Main results/ roadmap


= Background

// == Computational complexity
// - AC0
// - TC0
// - NC1
// - Turing-computable functions
// - Why these classes matter for transformers

== Formal languages / tasks <formal-languages>

In the following, we introduce some formal languages or language learning tasks, that are commonly used to study the capabilities of transformers, as they seem relatively simple but both empirically and theoretically are hard for transformers to learn correctly. We will use these tasks as running examples throughout the tutorial. 


- Parity: The input is a string over $\{a,b\}$, and the task is to determine whether the number of $a$ symbols is even. Equivalently, $a$ and $b$ can be encoded as bits 1 and 0.
- Dyck: The input is a string over different types of parentheses, and the task is to determine whether the parentheses are correctly nested.
- Dyck-1: The input is a string over a single type of parentheses, and the task is to determine whether the parentheses are correctly nested.
- Flip-flop: The input is a string over $\{a,b,e\}$, where $e$ is neutral. The task is to determine whether the last non-$e$ symbol is $b$; strings containing only $e$ symbols are rejected.
- Copying: Following #link(<huang-2025>)[Huang et al. (2025, Appendix E.2.1)], the model reads a sequence and generates a copy after a separator, for example `SOS b a b SEP b a b EOS`. Training loss is applied to the copied sequence and the final `EOS` token. The paper distinguishes _Copy (repeat)_, which allows repeated symbols from a binary alphabet, from _Copy (unique)_, whose input tokens are all distinct.

== Transformer models

We use the causal transformer model of #link(<huang-2025>)[Huang et al. (2025, Section 2)], whose length-generalization framework we study below. Each layer combines information across a prefix through attention, then applies a feedforward network separately at each position.

#details[Transformer equations and numerical assumptions][

*Input representation.* For a word $w = w_1 dots w_n$ over a finite alphabet $Sigma$, prepend a special BOS token at position 0. Write $m = n+1$ for the length including BOS. A transformer of width $d$ starts with vectors

$ h_i^(0) = e(w_i) + p_i in RR^d, quad 0 <= i <= n, $

where $w_0 = "BOS"$, $e$ is the token embedding, and $p_i$ is a positional vector. We distinguish no positional encodings (NoPE), where $p_i = 0$, from absolute positional encodings (APE), where $p_i$ encodes position $i$. A finite context window bounds $m$; positional encodings and offsets are discussed below.

*Causal attention.* A model has $L$ layers and $H$ heads per layer. At layer $ell$, head $h$ forms queries, keys, and values using learned matrices:

$ q_i = Q_(ell,h) h_i^(ell-1), quad k_j = K_(ell,h) h_j^(ell-1), quad v_j = V_(ell,h) h_j^(ell-1). $

Suppressing the layer and head indices, its weights and output are

$ a_(i,j) = q_i dot k_j, quad
  alpha_(i,j) = frac(exp(s_m a_(i,j)), sum_(t=0)^i exp(s_m a_(i,t))), quad
  z_i = sum_(j=0)^i alpha_(i,j) v_j. $

The mask permits only $j <= i$. The usual fixed factor $1/sqrt(d_k)$ can be absorbed into the query or key matrices. Following Huang et al., we use $s_m = log m$; ordinary softmax instead uses $s_m = 1$. Equal logits give uniform attention over the visible prefix.

*Transformer blocks.* Summing the head outputs and adding residual connections gives

$ u_i^(ell) = h_i^(ell-1) + sum_(h=1)^H z_i^(ell,h), $

$ h_i^(ell) = u_i^(ell) + B_ell psi_ell (A_ell u_i^(ell) + b_ell). $

The feedforward map uses the same parameters at every position. Each coordinate of $psi_ell$ may use ReLU, $"ReLU"(x) = max(0,x)$, or Heaviside, $"H"(x) = 1$ for $x >= 0$ and 0 otherwise.

This formal model omits LayerNorm. Huang et al. sketch how to incorporate it into their framework in Appendix D.3, while their experiments use transformers with LayerNorm. We return to Yang and Chiang's use of LayerNorm when discussing the original C-RASP compilation.

*Numerical precision.* Huang et al. round attention logits and exponential outputs to a fixed number of fractional bits, while allowing other activations to have unbounded precision. Their precision restriction therefore applies to specific parts of attention rather than to every intermediate value. We discuss the numerical assumptions of the original C-RASP compilation alongside that construction below.

*Output.* After $L$ layers, a linear map $U h_i^(L)$ produces output logits at position $i$. For language recognition, the output at the final input position determines whether the input is accepted.

]

=== Forward-pass Expressivity

We first ask which languages a fixed transformer can recognize in a single forward pass. Its depth $L$, width $d$, and number of heads $H$ are independent of the input length. Increasing the input length adds positions to the computation, while the number of layers remains fixed. We consider autoregressive generation, which runs further forward passes to generate additional tokens, in the chain-of-thought section.

= C-RASP

== Motivation
- Why introduce C-RASP?
- What does it abstract away / capture?

== Definition

A C-RASP program is a fixed finite sequence of assignments defining vectors indexed by input positions. Boolean-valued vectors represent predicates on positions; count-valued vectors assign an integer to each position. Assignments are evaluated in sequence, each defining a whole vector from the input and previously defined vectors. Both the number of assignments and the permitted operations are independent of the input length.

Our running example is Dyck-1, the language of correctly nested parentheses over the alphabet $Sigma = {"(", ")"}$. We will trace the program on the input `()(())`. 

*Input representation.* We assume that inputs are words over a finite alphabet $Sigma$, corresponding to tokens in a transformer. For each character $a in Sigma$, we create an initial Boolean vector $Q_a in \{0,1\}^n$, where $n$ is the input length. Its entry $Q_a(i)$ is 1 if the input character at position $i$ is $a$, and 0 otherwise. In other words, each $Q_a$ marks all the positions containing the character $a$.

The two input-marker vectors for our example are:

$ Q_"(" = [1, 0, 1, 1, 0, 0], $

$ Q_")" = [0, 1, 0, 0, 1, 1]. $

Both kinds of vectors have one entry per input position, but their entries mean different things. A Boolean-valued vector answers a yes-or-no question at each position: for example, $Q_"("(i)$ says whether position $i$ contains an opening parenthesis. 
A count-valued vector instead stores a number at each position: $C_"("(i)$ tells us how many opening parentheses have appeared from the start through position $i$. Thus, $Q_"("$ marks individual tokens, while $C_"("$ summarizes prefixes. Prefix counting turns a Boolean predicate into counts; comparing counts, as in $V(i)$ below, produces a Boolean predicate again.

We now combine these markers into a recognizer.

#block[
  #set math.equation(numbering: "(1)")

*Prefix counts.* First, count how many opening and closing parentheses have appeared up to each position. The notation $"#" [j <= i] P(j)$ counts the positions $j$ up to $i$ where the predicate $P$ is true:

$ C_"("(i) := "#" [j <= i] Q_"("(j) $

$ C_")"(i) := "#" [j <= i] Q_")"(j) $

For $()(())$, these vectors are $C_"(" = [1, 1, 2, 3, 3, 3]$ and $C_")" = [0, 1, 1, 1, 2, 3]$. Each entry records the count at the corresponding prefix.

*Prefix violations.* A valid string must never close more parentheses than it has opened. Mark each position where this condition fails:

$ V(i) := C_"("(i) < C_")"(i) $

For $()(())$, no prefix has more closing than opening parentheses, so $V = [0, 0, 0, 0, 0, 0]$.

Then count the positions marked as violations and check whether that count is zero:

$ C_V(i) := "#" [j <= i] V(j) $ 

$ M(i) := C_V(i) = 0 $

For this input, $C_V = [0, 0, 0, 0, 0, 0]$ and $M = [1, 1, 1, 1, 1, 1]$. In general, $M(i)$ is true exactly when no prefix ending at or before $i$ has violated the nesting condition.

*Balanced prefixes.* The final condition is that the prefix has equally many opening and closing parentheses:

$ B(i) := C_"("(i) = C_")"(i) $ 

$ D(i) := M(i) ∧ B(i) $

For this input, $B = [0, 1, 0, 0, 0, 1]$ and $D = [0, 1, 0, 0, 0, 1]$. The prefix `()` is balanced at position 2, and the entire string is balanced at position 6. Following #link(<yang-chiang-2024>)[Yang and Chiang (2024, Definition 3.1)], a recognition program must end with a Boolean-valued operation $D$ and accepts a word $w$ exactly when $D(|w|)$ is true. Here, $D$ is the output vector, and $D(6) = 1$, so $()(())$ is in Dyck-1.
]

The two conditions are both necessary. The string `())(` has equal total numbers of opening and closing parentheses, but it has already closed one too many at position 3. It therefore fails the prefix condition and is rejected.

#interactive-notebook()

#details[Reference: all allowed C-RASP operations][

The full set of allowed operations is:

#operation-columns(
  [
    *Boolean-valued vectors*
    #table(
      columns: (auto, 1fr),
      inset: 2pt,
      row-gutter: 5pt,
      [*Input marker*], [$P(i) := Q_a(i)$ for $a in Sigma$],
      [*Negation*], [$P(i) := ¬P_1(i)$],
      [*Conjunction*], [$P(i) := P_1(i) ∧ P_2(i)$],
      [*Count comparison*], [$P(i) := C_1(i) <= C_2(i)$],
      [*Constant*], [$P(i) := 1$],
    )
  ],
  [
    *Count-valued vectors*
    #table(
      columns: (auto, 1fr),
      inset: 2pt,
      row-gutter: 5pt,
      [*Prefix count*], [$C(i) := "#" [j <= i] P(j)$],
      [*Conditional*], [$C(i) := P(i) ? C_1(i) : C_2(i)$],
      [*Addition*], [$C(i) := C_1(i) + C_2(i)$],
      [*Subtraction*], [$C(i) := C_1(i) - C_2(i)$],
      [*Minimum*], [$C(i) := min(C_1(i), C_2(i))$],
      [*Maximum*], [$C(i) := max(C_1(i), C_2(i))$],
      [*Constant*], [$C(i) := 1$],
    )
  ],
)

*Semantics of prefix counting.* The operator $"#" [j <= i] P(j)$ counts the positions from 1 through $i$ at which $P$ is true, including position $i$ itself. Identifying false with 0 and true with 1, this means

$ C(i) := "#" [j <= i] P(j) = sum_(j=1)^i P(j). $

For example, $P = [1, 0, 1, 1]$ gives $C = [1, 1, 2, 3]$. The result is 0 when no position in the prefix satisfies $P$.

As in the paper's examples, we use derived shorthand: 0 can be defined as $1 - 1$, equality by two opposite $<=$ comparisons, and $C_1 < C_2$ by $not(C_2 <= C_1)$.

]

The Dyck-1 recognizer above uses prefix counting, count comparisons, and Boolean conjunction. 



== Examples

The languages from #link(<formal-languages>)[the task overview] illustrate which computations C-RASP can express. Here we ask whether a fixed program recognizes a language; whether training finds that program is a separate question.

In the equal-block examples below, $n$ denotes the length of each block; the total input length is $|w|$.

=== Expressible in C-RASP

==== $a^*b^*$

Strings in which every $a$ precedes every $b$. The blocks need not have equal length:

#details[Worked program for strings in $a^*b^*$][

#table(
  columns: (auto, auto, auto),
  align: (right, center, left),
  [$C_b(i)$], [$:=$], [$"#" [j <= i] Q_b(j)$],
  [$S_b(i)$], [$:=$], [$¬(C_b(i) <= 0)$],
  [$V(i)$], [$:=$], [$Q_a(i) ∧ S_b(i)$],
  [$C_V(i)$], [$:=$], [$"#" [j <= i] V(j)$],
  [$M(i)$], [$:=$], [$C_V(i) = 0$],
  [$D(i)$], [$:=$], [$M(i)$],
)

The program rejects exactly when an $a$ appears after a $b$. It accepts `aaabbb`, `bbb`, and the empty string, but rejects `ba`.

]

==== $a^n b^n$

Strings consisting of $n$ $a$ symbols followed by $n$ $b$ symbols, for $n >= 1$. Over the alphabet $\{a,b\}$, the program below checks the block order, equal counts, and nonempty input:

#details[Worked program for strings in $a^n b^n$][

#table(
  columns: (auto, auto, auto),
  align: (right, center, left),
  [$C_a(i)$], [$:=$], [$"#" [j <= i] Q_a(j)$],
  [$C_b(i)$], [$:=$], [$"#" [j <= i] Q_b(j)$],
  [$S_b(i)$], [$:=$], [$¬(C_b(i) <= 0)$],
  [$V(i)$], [$:=$], [$Q_a(i) ∧ S_b(i)$],
  [$C_V(i)$], [$:=$], [$"#" [j <= i] V(j)$],
  [$M(i)$], [$:=$], [$C_V(i) = 0$],
  [$E(i)$], [$:=$], [$C_a(i) = C_b(i)$],
  [$N(i)$], [$:=$], [$¬(C_a(i) <= 0)$],
  [$D(i)$], [$:=$], [$M(i) ∧ E(i) ∧ N(i)$],
)

Here, $S_b(i)$ indicates that a $b$ has appeared by position $i$, and $V(i)$ flags an $a$ that appears after such a $b$. Thus $M(|w|)$ ensures that all $a$ symbols precede all $b$ symbols, while $E(|w|)$ ensures that their total counts agree. The nonempty condition $N(|w|)$ excludes the empty string. The program accepts exactly when $D(|w|) = 1$, recognizing $a^n b^n$ for $n >= 1$.

]

==== Dyck-1

The program above recognizes this language by checking that no prefix has more closing parentheses than opening parentheses and that the final counts are equal.

=== Not expressible in C-RASP

The following negative results hold even for C-RASP[Pos], the restricted positional extension introduced below, and hence also for the position-free language used here.

==== Parity

Strings over $\{a,b\}$ containing an even number of $a$ symbols. C-RASP can count $a$ symbols, but its allowed operations cannot recognize this modular property.

==== Flip-flop

The language $Sigma^* b e^*$ over $Sigma = \{a,b,e\}$. Membership depends on the last non-$e$ symbol being $b$.

=== Exercise: three equal blocks

Try to write a recognizer for strings of the form $a^n b^n c^n$ over $\{a,b,c\}$, with $n >= 1$. If you get stuck, open the hint before looking at the solution.

#details[Hint][

Start by computing prefix counts for each symbol. Use them to mark positions where the order is broken: an $a$ after any $b$ or $c$, or a $b$ after any $c$. Count these violations, then combine the no-violation check with a final comparison of the three counts and a check that they are nonzero.

]

#details[Solution][

Use $S_"bc"(i)$ to mark positions at or after the first $b$ or $c$, and $S_c(i)$ to mark positions at or after the first $c$. The disjunction below is shorthand for negation and conjunction: $P ∨ Q := ¬(¬P ∧ ¬Q)$.

#table(
  columns: (auto, auto, auto),
  align: (right, center, left),
  [$C_a(i)$], [$:=$], [$"#" [j <= i] Q_a(j)$],
  [$C_b(i)$], [$:=$], [$"#" [j <= i] Q_b(j)$],
  [$C_c(i)$], [$:=$], [$"#" [j <= i] Q_c(j)$],
  [$S_"bc"(i)$], [$:=$], [$¬((C_b(i) <= 0) ∧ (C_c(i) <= 0))$],
  [$S_c(i)$], [$:=$], [$¬(C_c(i) <= 0)$],
  [$V_a(i)$], [$:=$], [$Q_a(i) ∧ S_"bc"(i)$],
  [$V_b(i)$], [$:=$], [$Q_b(i) ∧ S_c(i)$],
  [$V(i)$], [$:=$], [$V_a(i) ∨ V_b(i)$],
  [$C_V(i)$], [$:=$], [$"#" [j <= i] V(j)$],
  [$M(i)$], [$:=$], [$C_V(i) = 0$],
  [$E(i)$], [$:=$], [$(C_a(i) = C_b(i)) ∧ (C_b(i) = C_c(i))$],
  [$K(i)$], [$:=$], [$¬(C_a(i) <= 0) ∧ ¬(C_b(i) <= 0) ∧ ¬(C_c(i) <= 0)$],
  [$D(i)$], [$:=$], [$M(i) ∧ E(i) ∧ K(i)$],
)

$V_a$ flags an $a$ after a $b$ or $c$, while $V_b$ flags a $b$ after a $c$. Thus $M(|w|)$ enforces the block order. The conditions $E(|w|)$ and $K(|w|)$ require equal, nonzero counts, so the program accepts exactly $a^n b^n c^n$ for $n >= 1$.

]

// - *Unique copying:* Copying a sequence whose tokens are all distinct. Prior work shows this task is expressible in C-RASP, but its growing set of token identities lies outside the basic fixed-finite-alphabet setup. The paper discusses this caveat and treats vocabulary growth with C\*-RASP.

== From C-RASP programs to transformers

C-RASP provides a constructive lower bound on transformer expressivity: any C-RASP program can be simulated by a suitable transformer. Boolean operations are encoded by the transformer's feedforward layers, while prefix counting is implemented through attention.

The central idea is that uniform causal attention averages a predicate over the visible prefix. The resulting normalized counts share a positive denominator at each position, so comparing them gives the same answer as comparing the integer counts.

#details[Derivation: prefix counting with uniform attention][

For an input over a finite alphabet $Sigma$, represent the token at position $i$ by a one-hot vector $x_i in \{0,1\}^{|Sigma|}$, where $x_i[a] = 1$ exactly when the token is $a$. These coordinates are precisely the C-RASP indicators $Q_a(i)$. A standard transformer's token-embedding matrix maps this one-hot representation (or its equivalent token ID) to a learned vector.

*Counting with attention.* Following _Counting Like Transformers_ (#link(<yang-chiang-2024>)[Yang and Chiang, 2024]), the key idea is that attention can aggregate a predicate over a prefix. At position $i$, a causally masked attention head assigns position $j$ the weight

$ alpha_(i, j) = frac(exp(q_i dot k_j / sqrt(d_k)), sum_(t <= i) exp(q_i dot k_t / sqrt(d_k))), quad j <= i. $

Set $q_i dot k_j = 0$ for every visible position $j$ (for example, set all keys to zero). Each softmax score is then $exp(0) = 1$, so its normalized weight is $alpha_(i, j) = 1 / i$. With values encoding $P(j)$, attention returns

$ "Att"(x)_i = sum_(j <= i) alpha_(i, j) P(j) = 1 / i sum_(j <= i) P(j) = ("#" [j <= i] P(j)) / i. $


Thus attention can encode the C-RASP prefix count $C(i) := "#" [j <= i] P(j)$ as the normalized count

$ tilde(C)(i) := C(i) / i. $

At each position $i$, count values share the positive normalization factor $1/i$, so comparisons between them are unchanged. Counts can also be combined using arithmetic and conditional selection, as described below. Constants must use the same encoding: the integer constant 1 is represented by $1/i$, and more generally a constant $c$ by $c/i$. 

For Dyck-1, for example, $C_"("$ becomes $tilde(C_"(") = [1, 1\/2, 2\/3, 3\/4, 3\/5, 1\/2]$. Both opening- and closing-counts share divisor $i$, so their comparisons-and hence the prefix-balance test—are unchanged.

]

#details[Arithmetic and numerical precision][

Sums, differences, minima, maxima, and conditional selection also preserve this shared divisor, allowing normalized counts to flow through the program. Distinguishing adjacent normalized counts requires resolution on the order of $1/i$, so a fixed number of fractional bits cannot suffice at arbitrary lengths. This motivates allowing logarithmic precision for these attention results: for inputs of length at most $n$, $log_2(n) + O(1)$ fractional bits give resolution finer than the smallest adjacent-count gap $1/n$. This observation concerns the resolution of the normalized counts, rather than a guarantee that rounding every intermediate computation to this precision preserves the full simulation.

]

#details[Constants and the BOS token][

The simplified calculation above omits the beginning-of-sequence (BOS) token used in the full construction. With BOS preceding the $i$ ordinary input tokens, uniform attention averages over $i+1$ positions. Assigning value 1 at BOS and 0 elsewhere therefore yields $1/(i+1)$, the normalized encoding of the integer constant 1. Ordinary predicates are false at BOS, so their counts are encoded as $C(i)/(i+1)$. Counts and constants thus share the same denominator (#link(<yang-chiang-2024>)[Yang and Chiang, 2024, Appendix B.2]).

]

#details[How LayerNorm is handled][

For clarity, this explanation omits LayerNorm, but it can be accounted for in the compilation. #link(<yang-chiang-2024>)[Yang and Chiang (2024, Section 5.2 and Appendix B.3)] use paired coordinates with opposite signs, ensuring zero mean so that LayerNorm applies a shared scaling factor at each position. Their construction handles this scaling when implementing Boolean values and count comparisons.

]

Putting these constructions together, any fixed C-RASP program can be compiled into a transformer whose depth and width are independent of the input length.

This compilation establishes representability, but does not imply that training will find the constructed solution. Empirical studies nevertheless find that C-RASP expressibility predicts length generalization on a range of algorithmic and formal-language tasks (#link(<huang-2025>)[Huang et al., 2025]).


== Positional information

So far, we have not used explicit positional embeddings. Positions are distinguished only by their tokens and the information available from their prefixes through causal attention. Positional embeddings provide an additional, explicit representation of *where* each token occurs. Here we consider absolute positional embeddings: each position $i$ has its own learned vector $p_i$, which is added to the token embedding $e(x_i)$:

$ h_i = e(x_i) + p_i. $

=== Finite positional tables and offsets

The position vectors are stored in a finite table, so the model is defined only up to its maximum context length $L$. To train the embeddings across this table using shorter examples, the *offset trick* assigns an example of length $k$ the positional vectors $p_(o+1), dots, p_(o+k)$ for a valid offset $o$. Varying the offset allows training examples to occur throughout the context window, but does not guarantee that every position is observed in a finite training run or teach the model to generalize to longer examples. Since the table is still finite, the C-RASP simulation cannot be realized by one such fixed transformer for inputs of arbitrary length. Instead, consider a sequence of transformers with increasing context lengths and corresponding positional tables. To describe the underlying computations across these context lengths, the framework introduces a mathematical object called a limit transformer.

=== Limit transformers

A limit transformer is an idealized model that captures the positional information provided by positional embeddings while remaining defined on inputs of arbitrary length. It has fixed width and finite-precision parameters. Besides positional vectors $p_i$, it can use an additional positional function in each attention head. Writing $i$ for the query position and $j$ for the key position, the attention logit has the form

$ a_(i,j)^(l,h) = q_i^(l,h) dot k_j^(l,h) + r_(l,h)(i,j). $

The term $r_(l,h)(i,j)$ directly expresses a relation between positions, such as whether $j$ immediately precedes $i$. This allows the model to describe positional interactions at every input length without storing a separate learned vector for every position in a growing table.

For the length-generalization result, the positional vectors must be periodic, and the additional positional functions must be translation-invariant and local. Below, $r$ denotes the positional function of one attention head, with query position $i$ and key position $j <= i$.

_Periodicity._ The positional vectors repeat with a fixed positive integer period $Delta$:

$ p_(i + Delta) = p_i quad "for every" i >= 1. $

For example, period 2 allows alternating vectors $(u, v, u, v, dots)$ for odd and even positions. The sequence is infinite, but only $Delta$ vectors need to be specified, independently of the input length.

_Translation invariance._ Shifting both positions equally leaves the interaction unchanged:

$ r(i + s, j + s) = r(i,j) quad "for every integer" s >= 0. $

For example, assigning score 1 to the preceding position and 0 elsewhere treats $(2,1)$ and $(8,7)$ identically. Singling out absolute position $j = 1$ would violate translation invariance.

_Locality._ The additional positional interaction vanishes beyond a fixed nonnegative integer distance $tau$:

$ r(i,j) = 0 quad "whenever" i - j > tau. $

The preceding-position example is local with $tau = 1$. Assigning score 1 at every even distance is translation-invariant but not local. This restriction applies only to $r$; content-based attention can still aggregate over the entire prefix.

=== Positional information in C-RASP

We can express the same kinds of information at the program level by extending C-RASP to $"C-RASP"[Phi, Psi]$. Here, $Phi$ is a collection of Boolean predicates on individual positions, and $Psi$ is a collection of Boolean relations between pairs of positions. We add positional predicates

$ P(i) := phi(i), quad phi in Phi, $

and allow counting to be restricted by a positional relation:

$ C(i) := "#" [j <= i, psi(i,j)] P(j), quad psi in Psi union {top}. $

This counts positions $j$ for which both $P(j)$ and $psi(i,j)$ hold. Ordinary prefix counting remains a separate allowed primitive, represented here by the always-true relation $top$. The locality restriction applies to relations in $Psi$, not to this unrestricted prefix-counting operation.

For example, a unary predicate $phi(i)$ can mark the even positions. A binary relation $psi(i,j)$ can hold exactly when $j = i - 1$. Counting with this relation gives 1 if the preceding position satisfies $P$, and 0 otherwise, including when no preceding position exists. Comparing this count with 0 therefore lets a program test the preceding token.

When the predicates in $Phi$ are periodic and the relations in $Psi$ are translation-invariant and local, we obtain the variant we denote by $"C-RASP"["Pos"]$ throughout this tutorial. This abbreviates the notation $"C-RASP"["periodic", "local"]$ used by #link(<huang-2025>)[Huang et al. (2025)]. The position-free language introduced earlier is the special case with no added positional predicates or relations.


== From representability to length generalization

A C-RASP program specifies one computation that works at every input length. Compiling it into a transformer establishes that the computation is representable. Length generalization asks a further question: can a learner identify such a computation from its behavior on shorter inputs?

=== Training length and context length

To formalize this question, we must separate the lengths seen during training from the lengths the model can process. A model with context length $n$ can be tested on longer examples than it has seen, but only up to length $n$. Success within one fixed window therefore cannot establish generalization to arbitrarily long inputs. #link(<huang-2025>)[Huang et al. (2025)] address this by considering a sequence of transformers $T_n$ with increasing context length $n$. For each $n$, an idealized learner observes the target function $f$ on all inputs of length at most $n/2$ and selects $T_n$. We ask whether, for every sufficiently large $n$, this model also computes $f$ correctly on all unseen lengths between $n/2$ and $n$.

This definition captures the idea that, once the learner has seen sufficiently long examples, its solution continues to work at greater lengths. Increasing the context window prevents the model's finite positional table from setting an arbitrary ceiling on the analysis, while leaving the longer inputs unseen makes extrapolation necessary. The factor of two is a convenient choice, rather than an essential assumption of the framework. Observing *all* inputs through the training length also isolates generalization across lengths from the separate problem of learning from a finite sample. The resulting guarantee concerns this idealized inference procedure; it does not say that one trained finite-context model can process inputs of every length.

=== The idealized learner

The learner must fit every input through the training length and approximately minimize a complexity regularizer. Its positional contributions must also satisfy an offset-independence restriction. This is an idealized inference procedure; ordinary gradient-based training need not satisfy these assumptions.

#details[Formal selection rule and positional restrictions][

The selection rule requires $T_n$ to match $f$ exactly on *all* inputs through the training length and to approximately minimize a particular complexity regularizer among the models that do so. This regularizer controls quantities such as depth, precision, parameter norms, and positional interactions. The width $d$ is not explicitly bounded by the hypothesis class. More precisely, let $U_n$ be the set of admissible models that match $f$ on all inputs of length at most $n/2$, at every valid offset. The procedure selects $T_n in U_n$ satisfying

$ cal(R)(T_n) <= inf_(T in U_n) cal(R)(T) + 1/n. $

*Why approximate minimization?* An exact minimizer need not exist: the infimum may not be attained by any model in $U_n$. The allowance $1/n$ makes approximate minimization sufficient, with an error that vanishes as $n$ grows (#link(<huang-2025>)[Huang et al., 2025, Definition 6]).

A separate restriction concerns how the model uses positional information. Although the embeddings $p_i$ may vary across positions, the parameter products through which they contribute to the computation must be unchanged when all positions are shifted equally. This is stronger than requiring the same final prediction at every offset: the underlying computation must use positional information in the same way. For example, an interaction based on the distance between two positions survives such a shift, whereas one tied to a particular absolute position generally does not.

]

=== The main equivalence

Under the framework's assumptions, #link(<huang-2025>)[Huang et al. (2025, Theorem 7)] establish that the following statements are equivalent:

+ *Representation:* The target function $f$ is representable by a limit transformer with periodic positional vectors and translation-invariant, local additional positional interactions.
+ *Identification with bounded complexity:* Any sequence $T_n$ selected by the idealized inference procedure has uniformly bounded regularizer values and eventually generalizes. That is, there are constants $C$ and $N_0$ such that $cal(R)(T_n) <= C$ for every $n$, and for every $n > N_0$, $T_n$ matches $f$ on all inputs of length at most $n$, despite having fitted it only through length $n/2$.

The forward direction shows that such a representation guarantees eventual generalization with bounded complexity under the inference procedure. The reverse direction shows that a sequence selected by this procedure with both properties implies the existence of such a representation. Bounded regularization is part of this equivalence: eventual generalization alone is not the condition being characterized.

The procedure itself requires approximate minimization of the regularizer, rather than a prescribed uniform bound $C$. When the representation in the first statement exists, the theorem guarantees that the selected sequence remains uniformly bounded.

#details[Intuition: eliminating incorrect candidate algorithms][

Why is this possible? Under the theorem's assumptions, bounded complexity leaves only finitely many candidate underlying algorithms. Any incorrect candidate disagrees with $f$ on some finite input. As the training length increases, that input eventually becomes visible and rules out the candidate. Once every incorrect candidate has been eliminated, the remaining algorithms agree with $f$ at every length. This is a statement about the computations identified by the learner; it does not require the parameter vectors to converge to a unique set of weights.

]

=== What follows for C-RASP?

The compilation introduced above connects $"C-RASP"["Pos"]$ directly to the main equivalence: every such program supplies a limit-transformer representation satisfying the theorem's restrictions. Expressing a target function in $"C-RASP"["Pos"]$ therefore guarantees eventual generalization with bounded regularization under the idealized inference procedure. This is a sufficient condition; the converse claim that every such limit transformer has an equivalent C-RASP[Pos] program is not established.

=== How much training length is enough?

Eventual identification does not provide a practical stopping rule. #link(<yang-2026>)[Yang et al. (2026)], in _Length Generalization Bounds for Transformers_, show that no computable bound in terms of program description size exists for general C-RASP, even at counting depth two, with a corresponding result for the transformer model considered there. This concerns the maximum input length needed to distinguish candidate programs, rather than simply the number of training examples. The same work also identifies a restricted positive fragment, $"C-RASP"_+$, for which a computable bound does exist: the required training length is exponential in program description size, and this bound is optimal in the worst case. This fragment restricts count comparisons to nonnegative linear combinations of counts against constants. It is expressively equivalent to the paper's fully fixed-precision transformer model, for which the authors also obtain exponential bounds.

== Chain of thought
- Can CoT increase expressivity? (and how to fix this)
- C-RASP CoT

= Extensions / Limitations / Open Questions
- Open C-RASP conjecture
- Incomputable bound
- Extensions of C-RASP

= References

#block[Andy Yang and David Chiang. 2024. _Counting Like Transformers: Compiling Temporal Counting Logic Into Softmax Transformers._ COLM. #link("https://arxiv.org/abs/2404.04393")[arXiv:2404.04393].] <yang-chiang-2024>

#block[Xinting Huang, Andy Yang, Satwik Bhattamishra, Yash Sarrof, Andreas Krebs, Hattie Zhou, Preetum Nakkiran, and Michael Hahn. 2025. _A Formal Framework for Understanding Length Generalization in Transformers._ ICLR. #link("https://arxiv.org/abs/2410.02140")[arXiv:2410.02140].] <huang-2025>

#block[Andy Yang, Pascal Bergsträßer, Georg Zetzsche, David Chiang, and Anthony W. Lin. 2026. _Length Generalization Bounds for Transformers._ #link("https://arxiv.org/abs/2603.02238")[arXiv:2603.02238].] <yang-2026>
