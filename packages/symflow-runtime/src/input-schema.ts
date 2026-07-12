import {
  Node,
  Project,
  ScriptTarget,
  SyntaxKind,
  TypeFormatFlags,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type InterfaceDeclaration,
  type ParameterDeclaration,
  type PropertySignature,
  type SourceFile,
  type TypeAliasDeclaration,
  type TypeNode
} from 'ts-morph';

export interface WorkflowInputSchema {
  type: 'object';
  properties: Record<string, FieldSchema>;
  required: string[];
}

export interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  format?: 'uri' | 'binary' | 'date';
  description?: string;
  items?: FieldSchema;
}

export function inferInputSchema(workflowSource: string): WorkflowInputSchema | null {
  try {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: ScriptTarget.ES2022,
        strict: true
      }
    });
    const sourceFile = project.createSourceFile('/workflow.ts', workflowSource, { overwrite: true });
    const parameter = findMainInputParameter(sourceFile);
    const typeNode = parameter?.getTypeNode();
    if (!typeNode) return null;

    return schemaFromTypeNode(typeNode, sourceFile);
  } catch {
    return null;
  }
}

function findMainInputParameter(sourceFile: SourceFile): ParameterDeclaration | undefined {
  const declaration = sourceFile.getFunction('main');
  if (declaration?.isExported()) {
    return firstParameter(declaration);
  }

  for (const statement of sourceFile.getVariableStatements()) {
    if (!statement.isExported()) continue;
    for (const variable of statement.getDeclarations()) {
      if (variable.getName() !== 'main') continue;
      const initializer = variable.getInitializer();
      if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
        return firstParameter(initializer);
      }
    }
  }

  return undefined;
}

function firstParameter(
  declaration: FunctionDeclaration | ArrowFunction | FunctionExpression
): ParameterDeclaration | undefined {
  return declaration.getParameters()[0];
}

function schemaFromTypeNode(typeNode: TypeNode, sourceFile: SourceFile): WorkflowInputSchema | null {
  if (Node.isTypeReference(typeNode)) {
    return schemaFromTypeReference(typeNode, sourceFile);
  }

  if (!Node.isTypeLiteral(typeNode)) return null;
  return schemaFromMembers(typeNode.getMembers(), sourceFile);
}

function schemaFromTypeReference(typeNode: TypeNode, sourceFile: SourceFile): WorkflowInputSchema | null {
  if (!Node.isTypeReference(typeNode)) return null;
  if (typeNode.getTypeArguments().length > 0) return null;

  const typeName = typeNode.getTypeName().getText();
  const alias = sourceFile.getTypeAlias(typeName);
  if (alias) return schemaFromTypeAlias(alias, sourceFile);

  const declaration = sourceFile.getInterface(typeName);
  if (declaration) return schemaFromInterface(declaration, sourceFile);

  return null;
}

function schemaFromTypeAlias(alias: TypeAliasDeclaration, sourceFile: SourceFile): WorkflowInputSchema | null {
  const typeNode = alias.getTypeNode();
  if (!typeNode || typeNode.getKind() === SyntaxKind.TypeReference) return null;
  return schemaFromTypeNode(typeNode, sourceFile);
}

function schemaFromInterface(declaration: InterfaceDeclaration, sourceFile: SourceFile): WorkflowInputSchema | null {
  if (declaration.getExtends().length > 0) return null;
  return schemaFromMembers(declaration.getMembers(), sourceFile);
}

function schemaFromMembers(
  members: Array<ReturnType<InterfaceDeclaration['getMembers']>[number]>,
  sourceFile: SourceFile
): WorkflowInputSchema | null {
  const properties: Record<string, FieldSchema> = {};
  const required: string[] = [];

  for (const member of members) {
    if (!Node.isPropertySignature(member)) return null;
    const name = propertyName(member);
    const fieldTypeNode = member.getTypeNode();
    if (!name || !fieldTypeNode) return null;

    const field = fieldSchemaFromTypeNode(fieldTypeNode, name, sourceFile);
    if (!field) {
      if (member.hasQuestionToken()) continue;
      return null;
    }

    properties[name] = field;
    if (!member.hasQuestionToken()) {
      required.push(name);
    }
  }

  return { type: 'object', properties, required };
}

function fieldSchemaFromTypeNode(typeNode: TypeNode, propertyKey: string, sourceFile: SourceFile): FieldSchema | null {
  if (Node.isArrayTypeNode(typeNode)) {
    const item = fieldSchemaFromTypeNode(typeNode.getElementTypeNode(), propertyKey, sourceFile);
    if (!item || item.format === 'binary' || item.type === 'array') return null;
    return { type: 'array', items: item };
  }

  const kind = typeNode.getKind();
  if (kind === SyntaxKind.StringKeyword) {
    return { type: 'string', ...formatForStringProperty(propertyKey) };
  }
  if (kind === SyntaxKind.NumberKeyword) {
    return { type: 'number' };
  }
  if (kind === SyntaxKind.BooleanKeyword) {
    return { type: 'boolean' };
  }

  if (Node.isTypeReference(typeNode)) {
    const typeName = typeNode.getTypeName().getText();
    if (typeName === 'Array') {
      const [itemNode] = typeNode.getTypeArguments();
      if (!itemNode) return null;
      const item = fieldSchemaFromTypeNode(itemNode, propertyKey, sourceFile);
      if (!item || item.format === 'binary' || item.type === 'array') return null;
      return { type: 'array', items: item };
    }
    if (typeName === 'File' || typeName === 'Blob' || typeName === 'WorkflowFile') {
      return { type: 'string', format: 'binary' };
    }

    const alias = sourceFile.getTypeAlias(typeName);
    const aliasTypeNode = alias?.getTypeNode();
    if (aliasTypeNode) {
      return fieldSchemaFromTypeNode(aliasTypeNode, propertyKey, sourceFile);
    }
  }

  const typeText = typeNode.getType().getText(typeNode, TypeFormatFlags.UseSingleQuotesForStringLiteralType);
  if (typeText === 'File' || typeText === 'Blob' || typeText === 'WorkflowFile') {
    return { type: 'string', format: 'binary' };
  }

  return null;
}

function propertyName(property: PropertySignature): string | null {
  const nameNode = property.getNameNode();
  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText();
  }
  if (Node.isStringLiteral(nameNode) || Node.isNumericLiteral(nameNode)) {
    return nameNode.getLiteralText();
  }
  return null;
}

function formatForStringProperty(propertyKey: string): Pick<FieldSchema, 'format'> {
  if (/url|uri|image|template/i.test(propertyKey)) return { format: 'uri' };
  if (/date/i.test(propertyKey)) return { format: 'date' };
  return {};
}
