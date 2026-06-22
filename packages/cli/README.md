# spectrl

Local-first spec registry for managing versioned, composable structured documents.

## Installation

```bash
# Use directly with npx (no install required)
npx spectrl init

# Or install globally
npm install -g spectrl
```

## Quick Start

```bash
# Initialize a new project
spectrl init

# Create a new spec or a new power
spectrl new spec kewl-specc
spectrl new power mo-powa

# Publish to local registry
spectrl publish

# Install specs
spectrl install
```

## Commands

- `spectrl init` - Initialize a new project with a local spec index
- `spectrl new` - Create a new spec with a manifest template
- `spectrl publish` - Publish a spec to the local registry
- `spectrl install` - Install specs from the registry
- `spectrl login` - Authenticate with GitHub to access the public registry
- `spectrl search` - Search for specs in the public registry
- `spectrl info` - Show detailed information about a spec
- `spectrl list` - Show all installed specs
- `spectrl update` - Check for and install updates

Run `spectrl --help` or `spectrl <command> --help` for more information.

## Documentation

For full documentation, visit [spectrl.pro/docs/introduction](https://www.spectrl.pro/docs/introduction)

## License

MIT
