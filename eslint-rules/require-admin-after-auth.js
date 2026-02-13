export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure authenticateToken comes before requireAdmin in route middleware order.',
    },
    schema: [],
    messages: {
      order: 'authenticateToken must appear before requireAdmin in route middleware.',
    },
  },
  create(context) {
    const ROUTE_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'all']);

    function isRouteCall(node) {
      const callee = node.callee;
      return (
        callee &&
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property &&
        ROUTE_METHODS.has(callee.property.name)
      );
    }

    function isPathArg(node) {
      if (!node) return false;
      return (
        node.type === 'Literal' ||
        node.type === 'TemplateLiteral' ||
        node.type === 'RegExpLiteral'
      );
    }

    function flattenMiddlewareArgs(args) {
      const flat = [];
      args.forEach((arg) => {
        if (!arg) return;
        if (arg.type === 'ArrayExpression') {
          arg.elements.forEach((el) => {
            if (el) flat.push(el);
          });
        } else {
          flat.push(arg);
        }
      });
      return flat;
    }

    function getName(node) {
      if (!node) return null;
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'MemberExpression' && !node.computed && node.property) {
        return node.property.name;
      }
      return null;
    }

    return {
      CallExpression(node) {
        if (!isRouteCall(node)) return;
        const args = node.arguments || [];
        const startIndex = isPathArg(args[0]) ? 1 : 0;
        const middlewareArgs = flattenMiddlewareArgs(args.slice(startIndex));
        const names = middlewareArgs.map(getName);

        const authIndex = names.indexOf('authenticateToken');
        const adminIndex = names.indexOf('requireAdmin');

        if (authIndex !== -1 && adminIndex !== -1 && adminIndex < authIndex) {
          context.report({ node, messageId: 'order' });
        }
      },
    };
  },
};
