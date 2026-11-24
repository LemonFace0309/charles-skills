---
runs: 3
max_turns: 3
allowed_tools: [Skill, Read, Glob, Grep]
---
Why does this return undefined?

```js
function total(items) {
  items.reduce((sum, item) => sum + item.price, 0)
}
```
