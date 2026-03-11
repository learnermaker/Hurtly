# Contributing to BodyTrace

Thank you for your interest in contributing to BodyTrace! This document provides guidelines for contributing to the project.

## Code of Conduct

Be respectful, inclusive, and professional in all interactions.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/bodytrace.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Run tests: `npm test`
6. Commit your changes: `git commit -m "Add your feature"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

See the [README.md](README.md) for detailed setup instructions.

## Coding Standards

### TypeScript
- Use TypeScript for all new code
- Enable strict mode
- Provide proper type annotations
- Avoid `any` types

### Testing
- Write tests for all new features
- Maintain or improve test coverage
- Include both unit and integration tests
- Use property-based tests for correctness properties

### Code Style
- Follow the existing code style
- Run `npm run lint` before committing
- Use meaningful variable and function names
- Add comments for complex logic

### Commits
- Write clear, descriptive commit messages
- Use present tense ("Add feature" not "Added feature")
- Reference issue numbers when applicable

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add a clear description of your changes
4. Link related issues
5. Wait for review and address feedback

## Testing

```bash
# Run all tests
npm test

# Run specific workspace tests
npm test --workspace=backend
npm test --workspace=frontend

# Run tests in watch mode (during development)
npm test -- --watch
```

## Project Structure

- `frontend/` - React frontend application
- `backend/` - Node.js backend API
- `shared/` - Shared TypeScript types
- `.kiro/specs/` - Development specifications (not for public commit)

## Areas for Contribution

- Bug fixes
- Feature enhancements
- Documentation improvements
- Test coverage
- Performance optimizations
- Accessibility improvements
- Security enhancements

## Questions?

Open an issue for questions or discussions about potential contributions.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
