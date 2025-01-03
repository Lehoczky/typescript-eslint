import type { SourceFile } from 'typescript';

import type { ASTMaps } from './convert';
import type { ParseSettings } from './parseSettings';
import type { TSESTree } from './ts-estree';

import { Converter, convertError } from './convert';
import { convertComments } from './convert-comments';
import { convertTokens } from './node-utils';
import { simpleTraverse } from './simple-traverse';

export function astConverter(
  ast: SourceFile,
  parseSettings: ParseSettings,
  shouldPreserveNodeMaps: boolean,
): { astMaps: ASTMaps; estree: TSESTree.Program } {
  /**
   * The TypeScript compiler produced fundamental parse errors when parsing the
   * source.
   */
  const { parseDiagnostics } = ast;
  if (parseDiagnostics.length) {
    throw convertError(parseDiagnostics[0]);
  }

  /**
   * Recursively convert the TypeScript AST into an ESTree-compatible AST
   */
  const instance = new Converter(ast, {
    allowInvalidAST: parseSettings.allowInvalidAST,
    errorOnUnknownASTType: parseSettings.errorOnUnknownASTType,
    shouldPreserveNodeMaps,
    suppressDeprecatedPropertyWarnings:
      parseSettings.suppressDeprecatedPropertyWarnings,
  });

  const estree = instance.convertProgram();

  /**
   * Optionally remove range and loc if specified
   */
  if (!parseSettings.range || !parseSettings.loc) {
    simpleTraverse(estree, {
      enter: node => {
        if (!parseSettings.range) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- TS 4.0 made this an error because the types aren't optional
          // @ts-expect-error
          delete node.range;
        }
        if (!parseSettings.loc) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- TS 4.0 made this an error because the types aren't optional
          // @ts-expect-error
          delete node.loc;
        }
      },
    });
  }

  /**
   * Optionally convert and include all tokens in the AST
   */
  if (parseSettings.tokens) {
    estree.tokens = convertTokens(ast);
  }

  /**
   * Optionally convert and include all comments in the AST
   */
  if (parseSettings.comment) {
    estree.comments = convertComments(ast, parseSettings.codeFullText);
  }

  const astMaps = instance.getASTMaps();

  return { astMaps, estree };
}
