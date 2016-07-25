import {
  findCommentsInRaws,
  namespace,
} from "../../utils"
import { utils } from "stylelint"

export const ruleName = namespace("double-slash-comment-whitespace-inside")

export const messages = utils.ruleMessages(ruleName, {
  expected: "Expected a space after //",
  rejected: "Unexpected space after //",
})

export default function (expectation) {
  return (root, result) => {
    const validOptions = utils.validateOptions(result, ruleName, {
      actual: expectation,
      possible: [
        "always",
        "never",
      ],
    })
    if (!validOptions) { return }

    const comments = findCommentsInRaws(root.source.input.css)
    comments.forEach(comment => {
      // Only process // comments
      if (comment.type !== "double-slash") { return }

      let message

      if (comment.raws.left !== "" && expectation === "never") {
        message = messages.rejected
      } else if (comment.raws.left === "" && expectation === "always") {
        message = messages.expected
      } else {
        return
      }

      utils.report({
        message,
        node: root,
        index: comment.start,
        result,
        ruleName,
      })
    })
  }
}
