"""JSON adapter for the pinned coli-saar/c-rasp interpreter; not a replacement evaluator."""
import json
from antlr4 import InputStream, CommonTokenStream
from antlr4.error.ErrorListener import ErrorListener
from parser import CRaspLexer, CRaspParser, MyCraspVisitor

class ParseError(ErrorListener):
    def syntaxError(self, recognizer, offendingSymbol, line, column, msg, e):
        raise ValueError(f"Line {line}, column {column + 1}: {msg}")

class JSONTrace:
    def __init__(self):
        self.rows = []
    def accept_tokens(self, tokens):
        self.tokens = list(tokens)
    def accept(self, variable, value):
        self.rows.append({"name": variable, "values": list(value)})
    def accept_result(self, result):
        self.result = result

def run_trace(source, tokens):
    if not 1 <= len(tokens) <= 128:
        raise ValueError("Use between 1 and 128 tokens. Empty-input acceptance is not specified here.")
    if len(source) > 12000:
        raise ValueError("Program is limited to 12,000 characters.")
    lexer = CRaspLexer(InputStream(source))
    lexer.removeErrorListeners()
    lexer.addErrorListener(ParseError())
    stream = CommonTokenStream(lexer)
    parser = CRaspParser(stream)
    parser.removeErrorListeners()
    parser.addErrorListener(ParseError())
    tree = parser.program()
    stream.fill()
    if stream.LA(1) != -1:
        raise ValueError("Unexpected trailing input in program.")
    program = MyCraspVisitor().visit(tree)
    if not program.statements:
        raise ValueError("Add at least one assignment.")
    if len(program.statements) > 64:
        raise ValueError("Program is limited to 64 assignments.")
    trace = JSONTrace()
    try:
        result = program.execute(tokens, tracing=trace)
    except SystemExit as exc:
        raise ValueError("The interpreter could not evaluate this program; check variable names and types.") from exc
    if type(result) is not bool:
        raise ValueError("A recognition program must end in a Boolean-valued assignment.")
    return {"tokens": trace.tokens, "rows": trace.rows, "accepted": result,
            "engine": "coli-saar/c-rasp", "index_base": 0}
