/**
 * Finds comments, both CSS comments and double slash ones, in a CSS string
 * This helper exists because PostCSS drops some inline comments (those
 * between seelctors, property values, etc.)
 * https://github.com/postcss/postcss/issues/845#issuecomment-232306259
 *
 * @param [string] rawString -- the source raw CSS string
 * @return [array] array of objects with these props:
 *    � type -- "css" or "double-slash"
 *    � start -- 0-base index of the comment srart in the source string
 *    � end -- 0-base index of the comment end in the source string
 *    � raws
 *      raws.startToken -- `/*`, `/**`, `/**!`, etc.
 *      raws.left -- whitespace after the comment opening marker
 *      raws.text -- the full comment, including markers (//, /*)
 *      raws.right -- whitespace before the comment closing marker
 *      raws.endToken -- `*\/`, `**\/` for CSS comments
 *    � text -- the comment text only, excluding //, /*, trailing whitespaces
 *    � inlineAfter -- true, if there is something before the comment on
 *      the same line
 *    � inlineBefore -- true, if there is something after the comment on
 *      the same line
 */

export default function findCommentsInRaws(rawString) {
  const result = []
  let comment = {}
  // Keeps track of which structure the parser is inside (string, comment,
  // url function, parens). E.g., /* comment */ inside a string doesn't
  // constitute a comment, so as url(//path)
  const modesEntered = [{
    mode: "normal",
    character: null,
  }]
  
  for (let i = 0; i < rawString.length; i++) {
    const character = rawString[i]
    const prevChar = i > 0 ? rawString[i - 1] : null
    const nextChar = i + 1 < rawString.length ? rawString[i + 1] : null

    const lastModeIndex = modesEntered.length - 1
    const mode = modesEntered[lastModeIndex].mode
    
    switch (character) {
      // If entering/exiting a string
      case "\"":
      case "'": {
        if (mode === "comment") { break }
        if (mode === "string" &&
          modesEntered[lastModeIndex].character === character &&
          prevChar !== "\\"
        ) {
          // Exiting a string
          modesEntered.pop()
        } else {
          // Entering a string
          modesEntered.push({
            mode: "string",
            character,
          })
        }
        break
      }
      // Entering url, other function or parens (only url matters)
      case "(": {
        if (mode === "comment" || mode === "string") { break }
        const functionName =
          /(?:^|(?:\n)|(?:\r)|(?:\s-)|[:\s,.(){}*+/%])([a-zA-Z0-9_-]*)$/
            .exec(rawString.substring(0, i))[1]
        modesEntered.push({
          mode: functionName === "url" ? "url" : "parens",
          character: "(",
        })
        break
      }
      // Exiting url, other function or parens
      case ")": {
        if (mode === "comment" || mode === "string") { break }
        modesEntered.pop()
        break
      }
      // checking for comment
      case "/": {
        // break if the / is inside a comment because we leap over the second
        // slash in // and in */, so the / is not from a marker
        if (mode === "comment") { break }
        if (nextChar === "*") {
          modesEntered.push({
            mode: "comment",
            character: "/*",
          })
          comment = {
            type: "css",
            start: i,
            inlineAfter: rawString.substring(0, i).search(/\n\s*$/) === -1,
          }
          // Skip the next loop as the * is already checked
          i++
        } else if (nextChar === "/") {
          // `url(//path/to/file)` has no comment
          if (mode === "url") { break }
          modesEntered.push({
            mode: "comment",
            character: "//",
          })
          comment = {
            type: "double-slash",
            start: i,
            inlineAfter: rawString.substring(0, i).search(/\n\s*$/) === -1,
          }
          // Skip the next loop as the second slash in // is already checked
          i++
        }
        break
      }
      // Might be a closing */
      case "*": {
        if (mode === "comment" && modesEntered[lastModeIndex].character === "/*" && nextChar === "/") {
          comment.end = i + 1

          const commentRaw = rawString.substring(comment.start, comment.end + 1)
          const matches = /^(\/\*+[!#]{0,1})(\s*)([\s\S]*?)(\s*?)(\*+\/)$/.exec(commentRaw)
          modesEntered.pop()
          comment.raws = {
            startToken: matches[1],
            left: matches[2],
            text: commentRaw,
            right: matches[4],
            endToken: matches[5],
          }
          comment.text = matches[3]
          comment.inlineBefore = rawString.substring(i + 2).search(/^\s*?\S+\s*?\n/) !== -1
          result.push(Object.assign({}, comment))
          comment = {}
          // Skip the next loop as the / in */ is already checked
          i++
        }
        break
      }
      default: {
        // //-comments end before newline and if the code string ends
        if (character === "\n" || i === rawString.length - 1) {
          if (mode === "comment" && modesEntered[lastModeIndex].character === "//") {
            comment.end = character === "\n" ? i - 1 : i

            const commentRaw = rawString.substring(comment.start, comment.end + 1)
            const matches = /^(\/+)(\s*)(.*?)(\s*?)$/.exec(commentRaw)

            modesEntered.pop()
            comment.raws = {
              startToken: matches[1],
              left: matches[2],
              text: commentRaw,
              right: matches[4],
            }
            comment.text = matches[3]
            comment.inlineBefore = false
            result.push(Object.assign({}, comment))
            comment = {}
          }
        }
        break
      }
    }
    
  }

  return result
}