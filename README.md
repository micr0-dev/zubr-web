<h1 align="center">
	<img
		width="300"
		alt="Zubr"
		src="https://raw.githubusercontent.com/micr0-dev/zubr-web/master/client/img/zubr-logo-vertical.svg">
</h1>

<h3 align="center">
	Instance-based decentralized federated chat
</h3>

<p align="center">
	<strong>
		<a href="https://github.com/micr0-dev/zubr-server">Zubr Server</a>
		•
		<a href="https://github.com/micr0-dev/zubr-web">Zubr Web</a>
		•
		<a href="https://github.com/micr0-dev/zubr-web/issues">Issues</a>
	</strong>
</p>

## What is Zubr?

**Zubr-web** is a hard fork of [The Lounge](https://github.com/thelounge/thelounge). Zubr consists of two main components:

- **[Zubr Server](https://github.com/micr0-dev/zubr-server)**: A modern IRC server wrapper powered by insIRCd with enhanced features, built-in user management and authentication flow.
- **Zubr Web**: A feature-rich web client that works Zubr servers.

The point is to vertically integrate IRC experience, making it more user-friendly and accessible to a broader audience.

### Key Features

- **Modern web interface**: Beautiful, responsive design that works on desktop, tablet, and mobile
- **Always connected**: Stay online even when your browser is closed
- **Rich user experience**: Guest access, improved user management, server health monitoring, and more
- **Push notifications**: Never miss a message with real-time notifications
- **Link previews**: See previews of shared links directly in the chat
- **Cross-platform**: Runs anywhere Node.js runs

## Acknowledgments

Zubr would not exist without the incredible work of The Lounge team and community. **The Lounge** is an outstanding project that has made IRC accessible and enjoyable for countless users. We are deeply grateful for their years of dedication, thoughtful design, and excellent codebase.

This hard fork builds upon The Lounge's solid foundation to explore new directions in modernizing IRC. We encourage you to check out [The Lounge](https://thelounge.chat/) if you're looking for a stable, well-maintained IRC web client.

Special thanks to:
- The entire [The Lounge team](https://github.com/thelounge/thelounge/graphs/contributors) for their amazing work
- [Mattias Erming](https://github.com/erming) for creating the original Shout project

## Installation and Usage

### Prerequisites

Zubr Web requires:
- Latest [Node.js](https://nodejs.org/) LTS version or more recent
- [npm](https://www.npmjs.com/) package manager
- [Yarn](https://yarnpkg.com/) package manager

### Running from Source

```sh
git clone https://github.com/micr0-dev/zubr-web.git
cd zubr-web
yarn install
NODE_ENV=production yarn build
yarn start

```

For connecting to a Zubr server instance, configure the connection settings in your config file.

⚠️ **Note**: This is actively being developed. While functional, it may have bugs and breaking changes.

## Development Setup

Follow the instructions to run Zubr Web from source above, on your own fork.

Before submitting any changes:

1. Run `yarn test` to execute linters and the test suite
   - Run `yarn format:prettier` if linting fails
2. Run `yarn build:client` if you change anything in `client/js` or `client/components`
3. Run `yarn build:server` if you change anything in `server/`
4. Start the server with `yarn start`

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

For bug reports and feature requests, please use the [GitHub Issues](https://github.com/micr0-dev/zubr-web/issues) page.

## License

Zubr Web is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

This project is a hard fork of The Lounge, which is also MIT licensed. 
