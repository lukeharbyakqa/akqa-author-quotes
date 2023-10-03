# AKQA AUTHOR QUOTES

A simple lightweight app which calls the [quotable API](https://api.quotable.io) to retrieve information about various authors.

The API documentation can be found here: https://github.com/lukePeavey/quotable

## Setup

Copy the env.example file and populate it with your variables. Currently we only use the api URL (no token is necessary). However as the application grows, if other sensitive information needs to be stored in the env file this is best practice.

## Prerequisites

- Node
- NVM
- Svelte
- SASS

## Run the FE

This Svelte instance uses [rollup config](https://rollupjs.org/).

From the root execute

`npm run dev` (for local dev with a watch function)

`npm build` (for a production build)
