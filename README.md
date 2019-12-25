
## Getting started

```bash
git clone https://github.com/eunchurn/nodejs-babel-starter
rm -rf .git
```

change `package.json` to your own

```bash
npm install
```

or

```bash
yarn
```

done.

## Flow-typed install

```bash
yarn flow:install
```

## Flow check

```bash
yarn flow:check
```

## Test

```bash
yarn test
```

## Module resolve path configuration

```javascript
import something from 'libs/module'
```

instead of

```javascript
import something from '../../../../../libs/module'
```

### example configuration

- `src`: `./src`
- `libs`: `./src/libs`
- `build`: `./build/Release` (for [C/C++ Addons with N-API](https://nodejs.org/dist/latest/docs/api/n-api.html))

#### ESLint

Edit `.eslintrc`

```json
{
  "settings": {
    "import/resolver": {
      "alias": {
        "map": [
          ["src", "./src/"],
          ["libs", "./src/libs/"],
          ["build", "./build/Release/"]
        ],
        "extensions": [".js", ".json"]
      }
    }
  },
}
```

#### Babel

```json
{
  "plugins": [
    [
      "module-resolver",
      {
        "root": ["./"],
        "alias": {
          "@src": "./src",
          "@libs": "./src/libs",
          "@build": "./build/Release"
        }
      }
    ]
  ]
}
```

#### VSCode

Edit `.vscode/jsconfig.json`

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "src/*": ["src/*"],
      "libs/*": ["src/libs/*"],
      "build/*": ["build/Release/*"]
    }
  }
}
```

#### Flow-type

Edit `.flowconfig`

```yml
[options]
module.file_ext=.node
module.name_mapper='build' ->
'<PROJECT_ROOT>/build/Release'
module.file_ext=.js
module.name_mapper='libs' ->
'<PROJECT_ROOT>/src/libs'
module.file_ext=.js
module.name_mapper='src' ->
'<PROJECT_ROOT>/src'
```
