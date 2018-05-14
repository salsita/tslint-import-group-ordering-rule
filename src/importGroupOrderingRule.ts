import * as ts from 'typescript';
import * as Lint from 'tslint';

export class Rule extends Lint.Rules.AbstractRule {
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

  private get lastImport(): ImportDeclaration {
    return this.importStatements[this.importStatements.length - 1] || null;
  }

  public visitImportDeclaration(node: ts.ImportDeclaration): void {
    const current = this.parseImport(node);

    if (current.moduleText.startsWith('./..')) {
      this.addImportFailure(node, 'Import must not start with superfluous ./');
    }
    if (current.moduleText.endsWith('/index')) {
      this.addImportFailure(node, 'Import must not end with index');
    }

    const last = this.lastImport;

    if (last) {
      if (last.type > ImportType.Library  && current.type === ImportType.Library) {
        this.addImportFailure(node, 'Libraries must be imported first');
      }
      if (last.type > ImportType.NonLocal  && current.type === ImportType.NonLocal) {
        this.addImportFailure(node, 'Non-local import must come before Local one');
      }
      if (last.type !== current.type && !current.node.getFullText().match(/^\r?\n\r?\n/)) {
          this.addImportFailure(node, 'Blocks of Libraries, Local and Non-local imports must be divided by empty line');
      }
      if (last.type === ImportType.NonLocal && last.type === current.type && last.depth < current.depth) {
          this.addImportFailure(node, 'Non-local imports must be ordered from the most distant the closest');
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
