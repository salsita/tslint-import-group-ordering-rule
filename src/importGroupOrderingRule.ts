import * as ts from 'typescript';
import * as Lint from 'tslint';

const enum OPTIONS {
  CHECK_DOT = 'check-dot',
  CHECK_INDEX = 'check-index',
  CHECK_EMPTY_LINE = 'check-empty-line',
  CHECK_ORDER = 'check-order-within-group',
}

export class Rule extends Lint.Rules.AbstractRule {
  public static metadata: Lint.IRuleMetadata = {
    ruleName: 'import-group-ordering',
    description: 'Enforces strict order of groups of imports (libraries, non-local, local). Also provides some other minor import related enforcements.',
    rationale: 'Helps maintain a readable style in your codebase.',
    optionsDescription: 'Allow to turn on and off additional checks.',
    options: {
      type: 'object',
      properties: {
        [OPTIONS.CHECK_DOT]: {
          type: 'boolean',
        },
        [OPTIONS.CHECK_INDEX]: {
          type: 'boolean',
        },
        [OPTIONS.CHECK_EMPTY_LINE]: {
          type: 'boolean',
        },
        [OPTIONS.CHECK_ORDER]: {
          type: 'boolean',
        }
      },
      additionalProperties: false,
    },
    type: 'typescript',
    typescriptOnly: false,
    hasFix: false
  };

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(new CheckImportsWalker(sourceFile, this.getOptions()));
  }
}

const enum ImportType {
  Library,
  NonLocal,
  Local,
}

interface ImportDeclaration {
  node: ts.ImportDeclaration;
  moduleText: string;
  depth: number;
  type: ImportType;
}

class CheckImportsWalker extends Lint.RuleWalker {
  private importStatements: ImportDeclaration[] = [];
  private userOptions: any;

  constructor(sourceFile: ts.SourceFile, options: Lint.IOptions) {
    super(sourceFile, options);
    this.userOptions = this.getOptions()[0] || {};
  }

  private get lastImport(): ImportDeclaration {
    return this.importStatements[this.importStatements.length - 1] || null;
  }

  public visitImportDeclaration(node: ts.ImportDeclaration): void {
    const current = this.parseImport(node);

    if (this.userOptions[OPTIONS.CHECK_DOT] !== false) {
      if (current.moduleText.startsWith('./..')) {
        this.addImportFailure(node, 'Import must not start with superfluous ./');
      }
    }
    if (this.userOptions[OPTIONS.CHECK_INDEX] !== false) {
      if (current.moduleText.endsWith('/index')) {
        this.addImportFailure(node, 'Import must not end with index');
      }
    }

    const last = this.lastImport;

    if (last) {
      if (last.type > ImportType.Library  && current.type === ImportType.Library) {
        this.addImportFailure(node, 'Libraries must be imported first');
      }
      if (last.type > ImportType.NonLocal  && current.type === ImportType.NonLocal) {
        this.addImportFailure(node, 'Non-local import must come before Local one');
      }
      if (this.userOptions[OPTIONS.CHECK_EMPTY_LINE] !== false) {
        if (last.type !== current.type && !current.node.getFullText().match(/^\r?\n\r?\n/)) {
          this.addImportFailure(node, 'Blocks of Libraries, Local and Non-local imports must be divided by empty line');
        }
      }
      if (this.userOptions[OPTIONS.CHECK_ORDER] !== false) {
        if (last.type === ImportType.NonLocal && last.type === current.type && last.depth < current.depth) {
          this.addImportFailure(node, 'Non-local imports must be ordered from the most distant the closest');
        }
      }
    }

    this.importStatements.push(current);

    super.visitImportDeclaration(node);
  }

  private parseImport(node: ts.ImportDeclaration): ImportDeclaration {
    const moduleText = node.moduleSpecifier.getText().replace(/^[\"\']|[\"\']$/g, '');

    let depth = 0;
    moduleText.replace(/\.\.\//g, () => String(depth++));
    let type: ImportType;
    if (moduleText.startsWith('.')) {
      type = depth === 0 ? ImportType.Local : ImportType.NonLocal;
    } else {
      type = ImportType.Library;
    }

    const parseImport: ImportDeclaration = {
      node,
      moduleText,
      depth,
      type,
    };

    return parseImport;
  }

  private addImportFailure(node: ts.ImportDeclaration, failure: string): void {
    this.addFailure(this.createFailure(node.getStart(), node.getWidth(), failure));
  }
}
