#import "components.typ": details, operation-columns, interactive-notebook, notation-box, operation-table, c-rasp-editor-url

= Motivation

We want models to apply what they learn to problems larger than those encountered during training. A model trained on short sequences might later need to copy a longer passage, count events across a longer record, or check the structure of a larger program. When the underlying task stays the same, can the model carry out the same computation on inputs longer than the training examples? This is the problem of *length generalization*.

One motivation is to make better use of training data and computation. Long examples can be costly to collect, annotate, and process, and training cannot cover every input length a model may encounter. If shorter examples are sufficient to learn a reusable rule, we may reduce the need for long training examples while still handling longer inputs at test time. This does not necessarily mean that fewer training examples are needed overall: generalizing across lengths and learning from fewer samples are distinct goals.

Length generalization also asks whether the learned computation continues to work as the task grows. Counting, copying, and checking nested structure provide simple settings in which the same rule applies across lengths. A larger context window allows a model to receive longer inputs, but does not ensure that it processes them correctly. Throughout this tutorial, we therefore distinguish the lengths seen during training from the maximum length the model can process.

To understand what a transformer can learn from shorter inputs, we separate three questions:

+ *Representability:* Does there exist a transformer that computes the desired function across input lengths?
+ *Learnability:* Can a training procedure find a model that computes the function on the training distribution?
+ *Length-generalizable learnability:* Does training on bounded lengths yield a model that also computes the function on longer inputs?

A positive answer to one question does not settle the next. Constructing suitable weights establishes that a computation is possible, but does not show that training will find them. Likewise, perfect accuracy on shorter inputs does not establish length generalization. For example, a rule that checks whether parentheses are correctly nested only up to the maximum training length can agree with the desired recognizer on every training input and fail on every longer valid string. The observations alone do not distinguish that rule from a recognizer that works at all lengths. We therefore need to understand which computations the architecture can represent and which solutions the learning procedure favors.

Our main tool is *C-RASP*, a small programming language for computations over sequences. Its programs combine predicates on positions with counts over prefixes. A fixed program describes the same computation at every input length, making it possible to state an algorithm without choosing a maximum sequence length. C-RASP also connects these algorithms to transformers: prefix counts can be represented using attention, while feedforward layers implement comparisons and Boolean operations. This connection gives constructive expressivity results; it does not by itself establish a learning guarantee.

We first develop C-RASP through a worked parentheses recognizer and examples of what the language can and cannot express. We then explain its compilation into transformers and the role of positional information. This leads to the length-generalization framework of #link(<huang-2025>)[Huang et al. (2025)], which connects suitable representations to eventual generalization under an idealized inference procedure. We keep this guarantee separate from ordinary gradient-based training and discuss what it does, and does not, tell us about the training lengths required. The final sections outline how additional computation through chain of thought changes the question and which limitations remain open.


= Background

== Computational complexity <computational-complexity>

Complexity classes describe which problems can be solved with specified computational resources. For transformers, *circuit complexity* is useful because it separates the amount of computation performed in parallel from the number of sequential stages.

A Boolean circuit is a directed acyclic graph whose gates compute Boolean operations. Its *size* is the number of gates; its *depth* is the longest path from an input to the output. Gates at the same depth can be evaluated in parallel. To recognize inputs of arbitrary length, we use a family of circuits $(C_n)_(n >= 1)$, with one circuit for each input length $n$. Polynomial size means at most $n^{O(1)}$ gates, while constant depth means a bound independent of $n$. We use logspace-uniform families: one algorithm constructs $C_n$ from $n$ using $O(log n)$ working space, rather than choosing unrelated circuits separately at every length (#link(<immerman-1999>)[Immerman, 1999, Chapter 5]).

*Three circuit classes.* The following classes all require polynomial size but differ in their gates and depth:

- *$#math.sans("AC")^0$:* Constant-depth circuits with AND, OR, and NOT gates. AND and OR have unbounded fan-in: a single gate may combine arbitrarily many inputs. For example, testing whether a string contains an $a$ needs only an OR over the input indicators. Parity cannot be computed in this class.
- *$#math.sans("TC")^0$:* Constant-depth circuits that additionally allow unbounded-fan-in majority gates. A majority gate tests whether more than half its inputs are true; this gives the same class as allowing unweighted threshold gates. This class contains both majority and parity.
- *$#math.sans("NC")^1$:* Circuits of depth $O(log n)$ with AND and OR gates of fan-in at most two, and NOT gates. The additional depth allows information to be combined through a tree. For example, a balanced tree of constant-size XOR circuits computes parity in logarithmic depth.

The classes satisfy

$ #math.sans("AC")^0 subset #math.sans("TC")^0 subset.eq #math.sans("NC")^1. $

The first inclusion is strict; whether the second is strict remains open. Thus, constant depth alone does not determine expressive power: the permitted gates matter as well (#link(<viola-2023>)[Viola, 2023, Chapter 10]).

*Turing-computable functions.* A total function is Turing-computable if a single Turing machine halts and returns its value on every finite input. Unlike the circuit classes above, this imposes no polynomial time or small-depth bound. For a language, the corresponding notion is decidability: the machine must halt with the correct acceptance decision on every input. Computability asks whether an algorithm exists; complexity asks which resources it needs.

*Why these classes matter for transformers.* A fixed number of transformer layers suggests a bounded number of parallel stages, but a circuit simulation must also account for arithmetic precision and the operations within each layer. With $O(log n)$-bit arithmetic and feedforward maps computable in space linear in their input representation, a fixed transformer forward pass can be simulated in $#math.sans("TC")^0$ (#link(<merrill-sabharwal-2023>)[Merrill and Sabharwal, 2023]). Claims of Turing completeness concern a different resource regime and must specify how computation can grow, for example through additional generated tokens or iterations. Neither a circuit upper bound nor Turing completeness establishes that training will learn a solution that generalizes to longer inputs.

== Formal languages and sequence tasks <formal-languages>

We use a small set of tasks to study which computations transformers can represent and learn across input lengths. Their rules are easy to state, but involve different operations: counting, tracking order, checking nested structure, and reproducing a sequence. They will serve as running examples throughout the tutorial.

*Language recognition.* A formal language is a set of finite strings over an alphabet $Sigma$. A recognizer decides whether an input string belongs to that set. We consider:

- *Parity:* Accept a string over $\{a,b\}$ exactly when it contains an even number of $a$ symbols. Encoding $a$ as 1 and $b$ as 0 gives the usual bit-parity problem. For example, `aba` is accepted and `abb` is rejected.
- *Dyck-1:* Accept correctly nested parentheses of a single type. Every prefix must have at least as many opening as closing parentheses, and the final counts must agree. For example, `()(())` is accepted, while `())(` is rejected despite having equal final counts.
- *Dyck with multiple bracket types:* Require both correct nesting and matching bracket types. For example, `([])` is accepted, while `([)]` is rejected. Unlike Dyck-1, counting opening and closing brackets alone cannot check that their types match.
- *Flip-flop:* For a string over $\{a,b,e\}$, accept exactly when the last non-$e$ symbol is $b$. The symbol $e$ is neutral: appending it leaves the decision unchanged. For example, `abee` is accepted and `baee` is rejected. Strings with no $a$ or $b$, including the empty string, are rejected.

*Sequence generation.* Copying asks the model to produce an output sequence rather than an acceptance decision. After reading an input and a separator, it must reproduce the input in the same order. Following #link(<huang-2025>)[Huang et al. (2025, Appendix E.2.1)], an example is `SOS b a b SEP b a b EOS`. The paper distinguishes _Copy (repeat)_, with inputs over a binary alphabet that may contain repeated symbols, from _Copy (unique)_, in which all input tokens are distinct. Training loss is applied to the copied sequence and the final `EOS` token.

== Transformer models

We follow the causal transformer model of #link(<huang-2025>)[Huang et al. (2025, Section 2)]. Its main design choices are:

#table(
  columns: (1.2fr, 4fr),
  table.header([*Choice*], [*Setting*]),
  [Positions], [NoPE or learned APE.],
  [Attention], [Causal softmax, with logits scaled by $log m$.],
  [Blocks], [Residual attention and feedforward layers; fixed depth, width, and head count.],
  [Activations], [ReLU or Heaviside.],
  [Normalization], [LayerNorm omitted from the formal model.],
  [Precision], [Rounded attention logits and exponentials; other activations may have unbounded precision.],
  [Readout], [Final-position logits for recognition.],
)

Here $m$ includes the beginning-of-sequence token. The details below specify the computation and distinguish the formal model from the experiments.


#details[Transformer equations and numerical assumptions][

*Inputs and positions.* Let $w = w_1 dots w_n$ be a word over a finite alphabet $Sigma$. We prepend a special beginning-of-sequence token, $w_0 = "BOS"$, and write $m = n+1$ for the total sequence length. At each position $i$, the model maintains a vector $h_i^(ell) in RR^d$ after layer $ell$. The initial vector is

$ h_i^(0) = e(w_i) + p_i, quad 0 <= i <= n, $

where $e$ maps token identities to learned vectors. The optional vector $p_i$ supplies explicit positional information:

- With *no positional encodings (NoPE)*, $p_i = 0$ at every position. Positions can nevertheless have different representations because causal attention gives them access to different prefixes.
- With *absolute positional encodings (APE)*, each supported position has a learned vector $p_i$. The positional table is finite, so a fixed model supports only a finite context window. We discuss how offsets and increasing context lengths enter the generalization framework below.

*Causal attention.* A model has $L$ layers and $H$ attention heads per layer. Within layer $ell$, head $h$ applies learned linear maps to the previous layer's vectors:

$ q_i = Q_(ell,h) h_i^(ell-1), quad k_j = K_(ell,h) h_j^(ell-1), quad v_j = V_(ell,h) h_j^(ell-1). $

The query $q_i$ describes what position $i$ uses to score other positions; the key $k_j$ supplies the features against which it is scored. The value $v_j$ is the information that the head aggregates. Suppressing the layer and head indices, the computation is

$ a_(i,j) = q_i dot k_j, $

$ alpha_(i,j) = frac(exp(s_m a_(i,j)), sum_(t=0)^i exp(s_m a_(i,t))), quad j <= i, $

$ z_i = sum_(j=0)^i alpha_(i,j) v_j. $

The causal mask excludes positions $j > i$: a position can attend to BOS, itself, and earlier tokens, but not to future tokens. All queries, keys, and values in a layer come from the previous layer; the prefix restriction does not turn a layer into a left-to-right recurrent computation. The weights are nonnegative and sum to 1 over the visible prefix, so a head returns a weighted average of its values.

*Logit scaling and uniform attention.* Ordinary softmax attention uses $s_m = 1$. Huang et al. instead use $s_m = log m$, making the scale depend explicitly on sequence length. For positive $s_m$, the ratio between two attention weights is

$ frac(alpha_(i,j), alpha_(i,t)) = exp(s_m (a_(i,j) - a_(i,t))). $

Thus scaling changes how strongly the head distinguishes unequal scores. If all visible scores are equal, however, every visible position receives weight $1/(i+1)$. This is the uniform attention used later to represent prefix counts. The usual fixed factor $1/sqrt(d_k)$, where $d_k$ is the query/key dimension, can be absorbed into the learned query or key matrices. These equations display the algebraic operations; the rounding convention is stated below.

*Residual and feedforward updates.* Each head contributes a vector in the model's width-$d$ space; its value map incorporates the required output projection. The head outputs are summed and added to the current representation:

$ u_i^(ell) = h_i^(ell-1) + sum_(h=1)^H z_i^(ell,h). $

The feedforward update is

$ h_i^(ell) = u_i^(ell) + B_ell psi_ell (A_ell u_i^(ell) + b_ell). $

Here $A_ell$ maps into the feedforward hidden space, $b_ell$ is a bias vector, and $B_ell$ maps back to width $d$. The activation $psi_ell$ acts coordinatewise. Each coordinate may use ReLU,

$ "ReLU"(x) = max(0,x), $

or Heaviside,

$ "H"(x) = cases(1 & "if" x >= 0, 0 & "if" x < 0). $

The feedforward map uses the same parameters at every position within a layer. It does not itself combine different positions; that communication occurs through attention. The residual additions retain the preceding representation while adding the attention and feedforward contributions.

*LayerNorm.* The equations above omit normalization, as does Huang et al.'s main formal model. Their experiments include LayerNorm. Appendix D.3 sketches how to incorporate normalization into the limit-transformer simulation by retaining additional information from which activation norms can be recovered. We therefore distinguish the stated formal model from its proposed extension with normalization. Yang and Chiang's original C-RASP compilation uses LayerNorm explicitly; we return to its role alongside that construction.

*Numerical precision.* Huang et al. round attention logits and the outputs of the exponential function to a fixed number $p$ of fractional bits before further processing. Rounding to $p$ fractional bits restricts these quantities to multiples of $2^(-p)$; it does not impose a fixed total bit budget on every number in the computation. Other activations may retain unbounded precision. In particular, this model differs from one that rounds every stored activation and arithmetic result to a fixed number of bits. The circuit upper bound discussed next has its own precision assumptions and should not be transferred to this model without checking them.

*Output and computation budget.* After $L$ layers, a learned linear map produces the output logits

$ o_i = U h_i^(L). $

For recognition, the output at the final input position $i = n$ determines acceptance; for example, a binary readout can compare acceptance and rejection logits. A single forward pass applies the $L$ layers once. For a fixed transformer, its parameters, depth, width, and head count do not grow when the input gets longer. Autoregressive generation instead uses the output to append a token and runs another forward pass, introducing additional computation that we consider separately in the chain-of-thought section.

]

=== Forward-pass Expressivity

We first ask which languages a fixed transformer can recognize in a single forward pass. Its depth $L$, width $d$, and number of heads $H$ are independent of the input length. Increasing the input length adds positions to the computation, while the number of layers remains fixed.

The circuit classes introduced in #link(<computational-complexity>)[the complexity background] make this parallel structure precise. #link(<merrill-sabharwal-2023>)[Merrill and Sabharwal (2023)] show that transformers using $O(log n)$ bits of arithmetic precision, with feedforward maps computable in space linear in their input representation, can be simulated by logspace-uniform $#math.sans("TC")^0$ circuits. This is an upper bound on their forward-pass expressivity, not a claim that every such circuit can be represented by a transformer.

The precision assumption matters: Huang et al.'s model permits unbounded-precision activations, so this circuit bound does not apply to it directly. Nor does the bound characterize C-RASP: for example, $#math.sans("TC")^0$ contains parity, whereas C-RASP does not. We consider autoregressive generation, which runs further forward passes to generate additional tokens, in the chain-of-thought section.

= C-RASP

== Motivation
- Why introduce C-RASP?
- What does it abstract away / capture?

== Definition

A C-RASP program is a fixed finite sequence of assignments defining vectors indexed by input positions. Boolean-valued vectors represent predicates on positions; count-valued vectors assign an integer to each position. Assignments are evaluated in sequence, each defining a whole vector from the input and previously defined vectors. Both the number of assignments and the permitted operations are independent of the input length.

Our running example is Dyck-1, the language of correctly nested parentheses over the alphabet $Sigma = {"(", ")"}$. We will trace the program on the input `()(())`.

*Input representation.* We assume that inputs are words over a finite alphabet $Sigma$, corresponding to tokens in a transformer. For each character $a in Sigma$, we create an initial Boolean vector $Q_a in \{0,1\}^n$, where $n$ is the input length. Its entry $Q_(a)(i)$ is 1 if the input character at position $i$ is $a$, and 0 otherwise. In other words, each $Q_a$ marks all the positions containing the character $a$.

The two input-marker vectors for our example are:

$ Q_"(" = [1, 0, 1, 1, 0, 0], $

$ Q_")" = [0, 1, 0, 0, 1, 1]. $

Both kinds of vectors have one entry per input position, but their entries mean different things. A Boolean-valued vector answers a yes-or-no question at each position: for example, $Q_("(")(i)$ says whether position $i$ contains an opening parenthesis.
A count-valued vector instead stores a number at each position: $C_("(")(i)$ tells us how many opening parentheses have appeared from the start through position $i$. Thus, $Q_"("$ marks individual tokens, while $C_"("$ summarizes prefixes. Prefix counting turns a Boolean predicate into counts; comparing counts, as in $V(i)$ below, produces a Boolean predicate again.

We now combine these markers into a recognizer.

#block[
  #set math.equation(numbering: "(1)")

*Prefix counts.* First, count how many opening and closing parentheses have appeared up to each position. The notation $"#" [j <= i] P(j)$ counts the positions $j$ up to $i$ where the predicate $P$ is true:

$ C_("(")(i) := "#" [j <= i] Q_("(")(j) $

$ C_(")")(i) := "#" [j <= i] Q_(")")(j) $

For $()(())$, these vectors are $C_"(" = [1, 1, 2, 3, 3, 3]$ and $C_")" = [0, 1, 1, 1, 2, 3]$. Each entry records the count at the corresponding prefix.

*Prefix violations.* A valid string must never close more parentheses than it has opened. Mark each position where this condition fails:

$ V(i) := C_("(")(i) < C_(")")(i) $

For $()(())$, no prefix has more closing than opening parentheses, so $V = [0, 0, 0, 0, 0, 0]$.

Then count the positions marked as violations and check whether that count is zero:

$ C_(V)(i) := "#" [j <= i] V(j) $

$ M(i) := C_(V)(i) = 0 $

For this input, $C_V = [0, 0, 0, 0, 0, 0]$ and $M = [1, 1, 1, 1, 1, 1]$. In general, $M(i)$ is true exactly when no prefix ending at or before $i$ has violated the nesting condition.

*Balanced prefixes.* The final condition is that the prefix has equally many opening and closing parentheses:

$ B(i) := C_("(")(i) = C_(")")(i) $

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
    #operation-table(
      [*Input marker*], [$P(i) := Q_(a)(i)$ for $a in Sigma$],
      [*Negation*], [$P(i) := ¬P_(1)(i)$],
      [*Conjunction*], [$P(i) := P_(1)(i) ∧ P_(2)(i)$],
      [*Count comparison*], [$P(i) := C_(1)(i) <= C_(2)(i)$],
      [*Constant*], [$P(i) := 1$],
    )
  ],
  [
    *Count-valued vectors*
    #operation-table(
      [*Prefix count*], [$C(i) := "#" [j <= i] P(j)$],
      [*Conditional*], [$C(i) := P(i) ? C_(1)(i) : C_(2)(i)$],
      [*Addition*], [$C(i) := C_(1)(i) + C_(2)(i)$],
      [*Subtraction*], [$C(i) := C_(1)(i) - C_(2)(i)$],
      [*Minimum*], [$C(i) := min(C_(1)(i), C_(2)(i))$],
      [*Maximum*], [$C(i) := max(C_(1)(i), C_(2)(i))$],
      [*Constant*], [$C(i) := 1$],
    )
  ],
)

]

#notation-box[

*Semantics of prefix counting.* The operator $"#" [j <= i] P(j)$ counts the positions from 1 through $i$ at which $P$ is true, including position $i$ itself. Identifying false with 0 and true with 1, this means

$ C(i) := "#" [j <= i] P(j) = sum_(j=1)^i P(j). $

For example, $P = [1, 0, 1, 1]$ gives $C = [1, 1, 2, 3]$. The result is 0 when no position in the prefix satisfies $P$.

As in the paper's examples, we use derived shorthand: 0 can be defined as $1 - 1$, equality by two opposite $<=$ comparisons, and $C_1 < C_2$ by $not(C_2 <= C_1)$.


The Dyck-1 recognizer above uses prefix counting, count comparisons, and Boolean conjunction.

]

== Examples

Below we provide some more examples of C-RASP programms for some formal languages. In contrast we also discuss languages that are not expressible by C-RASP and hence are not expected to length-generalize.

=== Expressible in C-RASP

==== $a^*b^*$

The goal is to accept strings in which every $a$ precedes every $b$. Thse key idea is to mark an $a$ as a violation once a $b$ has appeared, then check that there are no violation.

#details[C-RASP Program for $a^*b^*$][

#table(
  columns: (auto, auto, auto),
  align: (right, center, left),
  [$C_(b)(i)$], [$:=$], [$"#" [j <= i] Q_(b)(j)$],
  [$S_(b)(i)$], [$:=$], [$¬(C_(b)(i) <= 0)$],
  [$V(i)$], [$:=$], [$Q_(a)(i) ∧ S_(b)(i)$],
  [$C_(V)(i)$], [$:=$], [$"#" [j <= i] V(j)$],
  [$M(i)$], [$:=$], [$C_(V)(i) = 0$],
)

*Reading the program.* $S_b$ records whether a $b$ has appeared; $V$ marks an $a$ after a $b$; and $M$ checks that no such position exists.

*Check.* `aaabbb` and `bbb` are accepted; `ba` is rejected. The empty word also belongs to $a^*b^*$.

]

==== Add equal counts: $a^n b^n$

Now require equally many $a$ and $b$ symbols, with at least one of each. The following program over $\{a,b\}$ checks block order, equal counts, and nonzero counts:

#details[C-RASP Program for $a^n b^n$][

#table(
  columns: (auto, auto, auto),
  align: (right, center, left),
  [$C_(a)(i)$], [$:=$], [$"#" [j <= i] Q_(a)(j)$],
  [$C_(b)(i)$], [$:=$], [$"#" [j <= i] Q_(b)(j)$],
  [$S_(b)(i)$], [$:=$], [$¬(C_(b)(i) <= 0)$],
  [$V(i)$], [$:=$], [$Q_(a)(i) ∧ S_(b)(i)$],
  [$C_(V)(i)$], [$:=$], [$"#" [j <= i] V(j)$],
  [$M(i)$], [$:=$], [$C_(V)(i) = 0$],
  [$E(i)$], [$:=$], [$C_(a)(i) = C_(b)(i)$],
  [$N(i)$], [$:=$], [$¬(C_(a)(i) <= 0)$],
  [$D(i)$], [$:=$], [$M(i) ∧ E(i) ∧ N(i)$],
)

*Reading the program.* $S_b$ records whether a $b$ has appeared, and $V$ marks any $a$ that appears after a $b$. The condition $M$ requires that there are no such violations, $E$ requires equal counts, and $N$ requires at least one $a$. The final output $D$ combines these three checks. Together they recognize $a^n b^n$ for $n >= 1$; the empty word is excluded.

*Check.* `aabb` is accepted. `aab` fails the count check, while `abab` has equal counts but fails the order check.
]

*TODO: other programms*

=== Not expressible in C-RASP

*Parity.* Strings over $\{a,b\}$ containing an even number of $a$ symbols. Parity is theoretically expressible by transformers, but both theoreticaly and experimentally it is not learnable. C-RASP can count $a$ symbols, but expressing modula properties is not possible.
*TODO* be more precise why Parity not in Crasp

*Flip-flop.* The language $Sigma^* b e^*$ over $Sigma = \{a,b,e\}$. Membership depends on the last non-$e$ symbol being $b$.
TODO C-RASP can not recover the last occurence of the non-e symbols.

=== Exercise: three equal blocks

Write a recognizer for strings of the form $a^n b^n c^n$ over $\{a,b,c\}$, with $n >= 1$. Extend the two-block construction in three steps:

+ Compute the three symbol counts.
+ Mark and count positions that violate the block order.
+ Combine the order check with equal, nonzero counts in the final Boolean output.

You can use the #link(c-rasp-editor-url)[drag-and-drop C-RASP editor (source and launch instructions)] to check your solution on concrete inputs and inspect the intermediate vectors. Test your solution on `abc` and `aabbcc` (accept), and on `aabcc`, `acb`, and `abccba` (reject). The last input has equal counts but the wrong order. These tests help catch mistakes; justify separately why your program works for every input length. Use the hint before consulting the solution.

#details[Hint][

Start by computing prefix counts for each symbol. Use them to mark positions where the order is broken: an $a$ after any $b$ or $c$, or a $b$ after any $c$. Count these violations, then combine the no-violation check with a final comparison of the three counts and a check that they are nonzero.

]

#context { if target() != "html" { pagebreak(weak: true) } }

#details[Solution][

Use $S_("bc")(i)$ to mark positions at or after the first $b$ or $c$, and $S_(c)(i)$ to mark positions at or after the first $c$. The disjunction below is shorthand for negation and conjunction: $P ∨ Q := ¬(¬P ∧ ¬Q)$.

#table(
  columns: (auto, auto, auto),
  align: (right, center, left),
  [$C_(a)(i)$], [$:=$], [$"#" [j <= i] Q_(a)(j)$],
  [$C_(b)(i)$], [$:=$], [$"#" [j <= i] Q_(b)(j)$],
  [$C_(c)(i)$], [$:=$], [$"#" [j <= i] Q_(c)(j)$],
  [$S_("bc")(i)$], [$:=$], [$¬((C_(b)(i) <= 0) ∧ (C_(c)(i) <= 0))$],
  [$S_(c)(i)$], [$:=$], [$¬(C_(c)(i) <= 0)$],
  [$V_(a)(i)$], [$:=$], [$Q_(a)(i) ∧ S_("bc")(i)$],
  [$V_(b)(i)$], [$:=$], [$Q_(b)(i) ∧ S_(c)(i)$],
  [$V(i)$], [$:=$], [$V_(a)(i) ∨ V_(b)(i)$],
  [$C_(V)(i)$], [$:=$], [$"#" [j <= i] V(j)$],
  [$M(i)$], [$:=$], [$C_(V)(i) = 0$],
  [$E(i)$], [$:=$], [$(C_(a)(i) = C_(b)(i)) ∧ (C_(b)(i) = C_(c)(i))$],
  [$K(i)$], [$:=$], [$¬(C_(a)(i) <= 0) ∧ ¬(C_(b)(i) <= 0) ∧ ¬(C_(c)(i) <= 0)$],
  [$D(i)$], [$:=$], [$M(i) ∧ E(i) ∧ K(i)$],
)

$V_a$ flags an $a$ after a $b$ or $c$, while $V_b$ flags a $b$ after a $c$. Thus $M(|w|)$ enforces the block order. The conditions $E(|w|)$ and $K(|w|)$ require equal, nonzero counts, so the program accepts exactly $a^n b^n c^n$ for $n >= 1$.

]

// - *Unique copying:* Copying a sequence whose tokens are all distinct. Prior work shows this task is expressible in C-RASP, but its growing set of token identities lies outside the basic fixed-finite-alphabet setup. The paper discusses this caveat and treats vocabulary growth with C\*-RASP.

== From C-RASP programs to transformers

C-RASP provides a constructive lower bound on transformer expressivity: any C-RASP program can be simulated by a suitable transformer. Boolean operations are encoded by the transformer's feedforward layers, while prefix counting is implemented through attention.

The central idea is that uniform causal attention averages a predicate over the visible prefix. The resulting normalized counts share a positive denominator at each position, so comparing them gives the same answer as comparing the integer counts.

#details[Derivation: prefix counting with uniform attention][

For an input over a finite alphabet $Sigma$, represent the token at position $i$ by a one-hot vector $x_i in \{0,1\}^{|Sigma|}$, where $x_i[a] = 1$ exactly when the token is $a$. These coordinates are precisely the C-RASP indicators $Q_(a)(i)$. A standard transformer's token-embedding matrix maps this one-hot representation (or its equivalent token ID) to a learned vector.

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
- how the model differs from real transformers (e.g., precision, attention, etc.)
- Other formalisms of length generalization (RASP-L etc.)

= References

#block[Neil Immerman. 1999. _Descriptive Complexity._ Springer. #link("https://people.cs.umass.edu/~immerman/book/ch5.pdf")[Chapter 5: Parallelism].] <immerman-1999>

#block[Emanuele Viola. 2023. _Mathematics of the Impossible_, Chapter 10: Constant-depth circuits. #link("https://emanueleviola.wordpress.com/2023/05/02/mathematics-of-the-impossible-chapter-10-constant-depth-circuits/")[Author's chapter].] <viola-2023>

#block[William Merrill and Ashish Sabharwal. 2023. _The Parallelism Tradeoff: Limitations of Log-Precision Transformers._ Transactions of the Association for Computational Linguistics, 11:531–545. #link("https://aclanthology.org/2023.tacl-1.31/")[ACL Anthology].] <merrill-sabharwal-2023>

#block[Andy Yang and David Chiang. 2024. _Counting Like Transformers: Compiling Temporal Counting Logic Into Softmax Transformers._ COLM. #link("https://arxiv.org/abs/2404.04393")[arXiv:2404.04393].] <yang-chiang-2024>

#block[Xinting Huang, Andy Yang, Satwik Bhattamishra, Yash Sarrof, Andreas Krebs, Hattie Zhou, Preetum Nakkiran, and Michael Hahn. 2025. _A Formal Framework for Understanding Length Generalization in Transformers._ ICLR. #link("https://arxiv.org/abs/2410.02140")[arXiv:2410.02140].] <huang-2025>

#block[Andy Yang, Pascal Bergsträßer, Georg Zetzsche, David Chiang, and Anthony W. Lin. 2026. _Length Generalization Bounds for Transformers._ #link("https://arxiv.org/abs/2603.02238")[arXiv:2603.02238].] <yang-2026>
