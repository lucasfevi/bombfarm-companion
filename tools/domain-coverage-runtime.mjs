import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const TRANSPILE_OPTIONS = {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  reportDiagnostics: false,
};

function isRuntimeFreeStatement(statement) {
  if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement) || ts.isEmptyStatement(statement)) return true;
  return ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression);
}

export function hasRuntimeCode(sourceText, fileName = 'module.ts') {
  const { outputText } = ts.transpileModule(sourceText, { ...TRANSPILE_OPTIONS, fileName });
  const emitted = ts.createSourceFile('emitted.js', outputText, ts.ScriptTarget.ESNext, false, ts.ScriptKind.JS);
  return !emitted.statements.every(isRuntimeFreeStatement);
}

export function runtimeBearingFiles(packageDirectory, sourceFiles) {
  return sourceFiles.filter((file) => hasRuntimeCode(readFileSync(path.join(packageDirectory, file), 'utf8'), file));
}
