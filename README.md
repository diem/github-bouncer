# bouncer

> A GitHub App built with [Probot](https://github.com/probot/probot) that Auto approval of github action jobs that use environments to access secrets based on branch and submitter.

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t bouncer .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> bouncer
```

## Contributing

If you have suggestions for how bouncer could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2021 Rex Hoffman <rexhoffman@fb.com>
