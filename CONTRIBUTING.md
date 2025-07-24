# Contributing to Puppeteer MCP Server

Thank you for your interest in contributing to the Puppeteer MCP Server! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git
- Docker (for containerized development)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/sultannaufal/puppeteer-mcp-server.git
   cd puppeteer-mcp-server
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Build and Test**
   ```bash
   npm run build
   npm test
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📋 Development Guidelines

### Code Style

- **TypeScript**: All new code must be written in TypeScript
- **ESLint**: Follow the project's ESLint configuration
- **Prettier**: Code formatting is handled by Prettier
- **Naming**: Use descriptive names for variables, functions, and classes
- **Comments**: Add JSDoc comments for public APIs

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

#### Examples

```bash
feat(tools): add new web scraping tool
fix(auth): resolve API key validation issue
docs(readme): update installation instructions
test(tools): add unit tests for navigation tool
chore(deps): update puppeteer to latest version
```

### Branch Naming

- `feature/description` - for new features
- `fix/description` - for bug fixes
- `docs/description` - for documentation updates
- `refactor/description` - for code refactoring

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tools/navigate.test.ts

# Run integration tests
npm run test:integration
```

### Writing Tests

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test API endpoints and tool interactions
- **Test Coverage**: Aim for >80% code coverage
- **Test Structure**: Use `describe` and `it` blocks with clear descriptions

#### Example Test

```typescript
import { NavigateTool } from '../src/tools/navigate';

describe('NavigateTool', () => {
  let tool: NavigateTool;

  beforeEach(() => {
    tool = new NavigateTool();
  });

  it('should navigate to valid URL', async () => {
    const result = await tool.execute({
      url: 'https://example.com'
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Successfully navigated');
  });

  it('should reject invalid URL', async () => {
    const result = await tool.execute({
      url: 'invalid-url'
    });

    expect(result.isError).toBe(true);
  });
});
```

## 🔧 Adding New Tools

### Tool Structure

1. **Create Tool File**: `src/tools/my-tool.ts`
2. **Extend BaseTool**: Inherit from the base tool class
3. **Define Schema**: Specify input validation schema
4. **Implement Execute**: Add the tool logic
5. **Add Tests**: Create comprehensive tests
6. **Register Tool**: Add to the tool registry
7. **Update Documentation**: Document the new tool

### Tool Template

```typescript
import { BaseTool } from './base';
import { ToolResult } from '@/types/mcp';
import { logger } from '@/utils/logger';

export class MyTool extends BaseTool {
  name = 'my_tool';
  description = 'Description of what this tool does';
  
  inputSchema = {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Description of parameter'
      },
      param2: {
        type: 'number',
        description: 'Optional numeric parameter',
        minimum: 0,
        maximum: 100
      }
    },
    required: ['param1']
  };

  async execute(args: any): Promise<ToolResult> {
    try {
      // Validate arguments
      this.validateArgs(args);

      // Tool implementation
      const result = await this.performAction(args);

      logger.info(`Tool ${this.name} executed successfully`, {
        args,
        result: result.substring(0, 100) // Log first 100 chars
      });

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ],
        isError: false
      };
    } catch (error) {
      logger.error(`Tool ${this.name} failed`, { error, args });
      
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async performAction(args: any): Promise<string> {
    // Implement your tool logic here
    return 'Tool result';
  }
}
```

### Tool Registration

Add your tool to `src/tools/index.ts`:

```typescript
import { MyTool } from './my-tool';

export const tools = [
  // ... existing tools
  new MyTool(),
];
```

## 🐛 Bug Reports

When reporting bugs, please include:

### Bug Report Template

```markdown
## Bug Description
A clear and concise description of what the bug is.

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior
A clear description of what you expected to happen.

## Actual Behavior
A clear description of what actually happened.

## Environment
- OS: [e.g. Ubuntu 20.04, macOS 12.0, Windows 11]
- Node.js version: [e.g. 18.17.0]
- npm version: [e.g. 9.6.7]
- Docker version: [e.g. 24.0.5] (if applicable)
- Browser: [e.g. Chrome 115.0] (if applicable)

## Logs
```
Paste relevant log output here
```

## Screenshots
If applicable, add screenshots to help explain your problem.

## Additional Context
Add any other context about the problem here.
```

## 💡 Feature Requests

### Feature Request Template

```markdown
## Feature Description
A clear and concise description of the feature you'd like to see.

## Use Case
Describe the use case and motivation for this feature.

## Proposed Solution
A clear description of how you envision this feature working.

## Alternatives Considered
Describe any alternative solutions or features you've considered.

## Additional Context
Add any other context, mockups, or examples about the feature request.
```

## 📝 Documentation

### Documentation Guidelines

- **Clarity**: Write clear, concise documentation
- **Examples**: Include practical examples
- **Structure**: Use consistent formatting and structure
- **Updates**: Keep documentation in sync with code changes
- **Accessibility**: Write for different skill levels

### Documentation Types

- **API Documentation**: Document all public APIs
- **Tool Documentation**: Document each tool's purpose and usage
- **Configuration**: Document all configuration options
- **Deployment**: Provide deployment guides for different platforms
- **Troubleshooting**: Include common issues and solutions

## 🔍 Code Review Process

### Pull Request Guidelines

1. **Title**: Use a clear, descriptive title
2. **Description**: Explain what changes were made and why
3. **Testing**: Include tests for new functionality
4. **Documentation**: Update relevant documentation
5. **Breaking Changes**: Clearly mark any breaking changes
6. **Size**: Keep PRs focused and reasonably sized

### Review Checklist

- [ ] Code follows project style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No breaking changes (or clearly documented)
- [ ] Performance impact considered
- [ ] Security implications reviewed
- [ ] Error handling is appropriate

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Peer Review**: At least one maintainer review required
3. **Testing**: Manual testing for significant changes
4. **Approval**: Maintainer approval required for merge
5. **Merge**: Squash and merge preferred

## 🚀 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Version Bump**: Update version in `package.json`
2. **Changelog**: Update `CHANGELOG.md`
3. **Tag**: Create git tag with version
4. **Build**: Create production build
5. **Test**: Run full test suite
6. **Publish**: Publish to npm (if applicable)
7. **Docker**: Build and push Docker images
8. **Documentation**: Update documentation

## 🤝 Community Guidelines

### Code of Conduct

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Inclusive**: Welcome people of all backgrounds and experience levels
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Patient**: Remember that everyone is learning
- **Be Professional**: Maintain professional communication

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Pull Requests**: Code contributions and reviews
- **Email**: security@yourproject.com for security issues

## 📚 Resources

### Learning Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/guide/)
- [Puppeteer Documentation](https://pptr.dev/)
- [Docker Documentation](https://docs.docker.com/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)

### Development Tools

- **IDE**: VS Code with TypeScript extension
- **Debugging**: Node.js debugger, Chrome DevTools
- **Testing**: Jest testing framework
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier code formatter

## ❓ Getting Help

If you need help:

1. **Check Documentation**: Review README and documentation
2. **Search Issues**: Look for existing issues and solutions
3. **Ask Questions**: Use GitHub Discussions for questions
4. **Contact Maintainers**: Reach out via email if needed

## 🙏 Recognition

Contributors will be recognized in:

- **README**: Contributors section
- **Releases**: Release notes acknowledgments
- **Documentation**: Author credits where appropriate

Thank you for contributing to the Puppeteer MCP Server! 🎉