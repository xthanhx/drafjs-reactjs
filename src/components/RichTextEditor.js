import React, {
  forwardRef,
  useState,
  useRef,
  useImperativeHandle,
  useEffect,
} from "react";
import { List } from "immutable";
import {
  genKey,
  ContentBlock,
  EditorState,
  Modifier,
  getDefaultKeyBinding,
  RichUtils,
  ContentState,
} from "draft-js";
import "./RichText.css";
import "../../node_modules/draft-js/dist/Draft.css";
import Editor from "draft-js-plugins-editor";
import createAutocompletePlugin from "draft-js-autocomplete-plugin-creator";
import Select from "react-select";

const choices = [
  {
    sentence_id: "1",
    sentence_name: "My diet",
    icon: "insert.svg",
    sentence_elements: [
      {
        type: "keyword",
        datatype: "string",
        value: "For my diet, I want",
      },
      {
        type: "input",
        datatype: "file",
        value: "input food",
      },
      {
        type: "keyword",
        datatype: "string",
        value: ", and this is for the",
      },
      {
        type: "input",
        datatype: "string",
        value: "input meal",
      },
      {
        type: "input",
        datatype: "string",
        value: "input day",
      },
    ],
  },
  {
    sentence_id: "2",
    icon: "copy.svg",
    sentence_name: "Collection of best books",
    sentence_elements: [
      {
        type: "input",
        datatype: "file",
        value: "input book",
      },
      {
        type: "keyword",
        datatype: "string",
        value: "is a good book",
      },
    ],
  },
  {
    sentence_id: "3",
    icon: "export.svg",
    sentence_name: "Collection of activities",
    sentence_elements: [
      {
        type: "keyword",
        datatype: "string",
        value: "I will do",
      },
      {
        type: "input",
        datatype: "string",
        value: "input action",
      },
      {
        type: "keyword",
        datatype: "string",
        value: "for",
      },
      {
        type: "input",
        datatype: "number",
        value: "input duration",
      },
      {
        type: "keyword",
        datatype: "string",
        value: "minutes",
      },
    ],
  },
];

const autocompletePlugin = createAutocompletePlugin({
  trigger: "/",
  component: ({ children }) => <span>{children} </span>,
});

const plugins = [autocompletePlugin];

const getCursorPosition = (editorState) => {
  const selectionState = editorState.getSelection();
  const anchorKey = selectionState.getAnchorKey();
  const currentBlockElement = document.querySelector(
    `[data-offset-key="${anchorKey}-0-0"]`
  );
  if (currentBlockElement) {
    const currentBlockRect = currentBlockElement.getBoundingClientRect();
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (range) {
      const rect = range.getBoundingClientRect();
      const top = currentBlockRect.top;
      const left = rect.left
        ? rect.left - currentBlockRect.left
        : currentBlockRect.left;
      return {
        top: top,
        left: left,
        range,
        anchorKey,
      };
    } else {
      return null;
    }
  }
};

class RichTextEditor extends React.Component {
  constructor(props) {
    super(props);

    const formulaText =
      "LED set color to dark green for 2 seconds\n\n\nMotor turn ACW with 50 % speed";
    const inputPhrasingText = ["dark green", "2", "ACW", "50 %", "with"];
    const initialEditorState = this.createInitialEditorState(
      formulaText,
      inputPhrasingText
    );

    this.state = {
      editorState: initialEditorState,
      autosuggestPosition: { top: 0, left: 0, range: null, anchorKey: "" },
      autoSuggest: { enable: false, content: "" },
    };
    this.editorRef = React.createRef();
    this.selectRef = React.createRef();
    this.focus = () => this.editorRef.current.focus();
    this.onChange = (editorState) => this.setState({ editorState });

    this.handleKeyCommand = this._handleKeyCommand.bind(this);
    this.mapKeyToEditorCommand = this._mapKeyToEditorCommand.bind(this);
    this.toggleBlockType = this._toggleBlockType.bind(this);
    this.toggleInlineStyle = this._toggleInlineStyle.bind(this);

    this.onChoiceSelect = this._onChoiceSelect.bind(this);
    this.onEditorChange = this._onEditorChange.bind(this);

    this.hiddenAutosuggest = this._hiddenAutosuggest.bind(this);
    this.showAutosuggest = this._showAutosuggest.bind(this);
    this.autoSelectFirstOption = this._autoSelectFirstOption.bind(this);
    this.createCharacterBlock = this._createCharacterBlock.bind(this);
    this.highlightFirst = this._highlightFirst.bind(this);
  }

  createInitialEditorState(initialText, inputPhrases) {
    let contentBlock = ContentState.createFromText(initialText);
    let block = contentBlock.getFirstBlock();

    inputPhrases.forEach((inputPhraseText) => {
      while (block !== undefined) {
        let text = block.getText();
        const inputPhraseStart = text.indexOf(inputPhraseText);
        if (inputPhraseStart !== -1) {
          const inputPhraseEnd = inputPhraseStart + inputPhraseText.length;

          const selectionState = contentBlock.getSelectionAfter().merge({
            anchorOffset: inputPhraseStart,
            focusOffset: inputPhraseEnd,
            anchorKey: block.key,
            focusKey: block.key,
          });

          contentBlock = Modifier.replaceText(
            contentBlock,
            selectionState,
            inputPhraseText,
            ["BOLD"]
          );
          break;
        } else {
          block = contentBlock.getBlockAfter(block.key);
        }
      }
    });

    return EditorState.createWithContent(contentBlock);
  }

  componentDidMount() {
    this.editorRef.current.focus();
  }

  _handleKeyCommand(command, editorState) {
    if (command === "tab-jump-next" || command === "tab-jump-previous") {
      const selection = editorState.getSelection();
      const contentState = editorState.getCurrentContent();
      let block = contentState.getBlockForKey(selection.getStartKey());
      let newSelection = selection;
      const direction = command === "tab-jump-next" ? 1 : -1;

      let count = 0;
      let targetOffsetStart = 0;
      let targetOffsetEnd = 0;
      let startIndex = selection.getStartOffset();

      while (block !== undefined) {
        let text = block.getText();
        if (direction === 1) {
          for (let i = startIndex; i <= text.length; i++) {
            let style = block.getInlineStyleAt(i).toString();
            if (style.indexOf("BOLD") === -1) {
              if (count === 0) count = 1;
              if (count === 2) {
                targetOffsetEnd = i === 0 ? text.length : i;
                newSelection = selection.merge({
                  anchorOffset: targetOffsetStart,
                  focusOffset: targetOffsetEnd,
                  anchorKey: block.key,
                  focusKey: block.key,
                });

                this.onChange(
                  EditorState.forceSelection(editorState, newSelection)
                );
                return "handled";
              }
            }
            if (style.indexOf("BOLD") !== -1) {
              if (count === 1) {
                targetOffsetStart = i;
                count = 2;
              }
            }
          }
          this.onChange(EditorState.forceSelection(editorState, newSelection));
          block = contentState.getBlockAfter(block.key);
          startIndex = 0;
        } else {
          let targetOffsetStart = undefined;
          let targetOffsetEnd = undefined;

          for (let i = startIndex; i >= 0; i--) {
            let style = block
              .getInlineStyleAt(i - 1 < 0 ? 0 : i - 1)
              .toString();
            if (style.indexOf("BOLD") === -1) {
              targetOffsetStart = i;
              if (targetOffsetEnd !== undefined && count === 1) {
                count = 2;
                break;
              }
            }

            if (style.indexOf("BOLD") !== -1) {
              if (targetOffsetEnd === undefined) {
                targetOffsetEnd = i;
                count = 1;
              }

              if (i === 0 && targetOffsetEnd !== undefined) {
                targetOffsetStart = i;
                count = 2;
              }
            }
          }

          if (count === 2 && targetOffsetEnd !== targetOffsetStart) {
            const newSelection = selection.merge({
              anchorOffset: targetOffsetStart,
              focusOffset: targetOffsetEnd,
              anchorKey: block.key,
              focusKey: block.key,
            });

            this.onChange(
              EditorState.forceSelection(editorState, newSelection)
            );

            return "handled";
          }

          block = contentState.getBlockBefore(block.key);
          if (block !== undefined) {
            startIndex = block.getText().length;
          }
        }
      }
    }

    return "not-handled";
  }

  _mapKeyToEditorCommand(e) {
    if (e.key === "/") {
      this.createCharacterBlock("/");
      setTimeout(() => {
        this.showAutosuggest();
      });
      return "not-handle";
    }

    if (e.keyCode === 32 && !this.state.autoSuggest.enable) {
      this.createCharacterBlock(" ");
      return "not-handle";
    }

    if (e.keyCode === 9 /* Tab */ && this.state.autoSuggest.enable) {
      this.autoSelectFirstOption();
      return "not-handle";
    }

    if (e.key === "Backspace" && e.metaKey && this.state.autoSuggest.enable) {
      this.hiddenAutosuggest();
    }

    if (e.key === "Backspace" && this.state.autoSuggest.enable) {
      const currentContent = this.state.autoSuggest.content;
      if (currentContent) {
        this.setState({
          autoSuggest: {
            ...this.state.autoSuggest,
            content: currentContent.slice(0, -1),
          },
        });
      } else {
        this.hiddenAutosuggest();
      }
    }

    if (e.key === "Escape" && this.state.autoSuggest.enable) {
      this.hiddenAutosuggest();
      return "not-handle";
    }

    if (e.keyCode === 9 /* Tab */ && !e.shiftKey) {
      return "tab-jump-next";
    }
    if (e.keyCode === 9 /* Tab */ && e.shiftKey) {
      return "tab-jump-previous";
    }

    if (e.key === "ArrowUp" && this.state.autoSuggest.enable) {
      setTimeout(() => {
        this.selectRef.current.focusOption("up");
      });
      return "not-handle";
    }

    if (e.key === "ArrowDown" && this.state.autoSuggest.enable) {
      setTimeout(() => {
        this.selectRef.current.focusOption("down");
      });
      return "not-handle";
    }

    if (e.key === "Enter" && this.state.autoSuggest.enable) {
      this.autoSelectFirstOption();
      return "not-handle";
    }

    return getDefaultKeyBinding(e);
  }

  _toggleBlockType(blockType) {
    this.onChange(RichUtils.toggleBlockType(this.state.editorState, blockType));
  }

  _toggleInlineStyle(inlineStyle) {
    this.onChange(
      RichUtils.toggleInlineStyle(this.state.editorState, inlineStyle)
    );
  }

  _onChoiceSelect = (selectedChoice) => {
    const state = this.state.editorState;
    const content = state.getCurrentContent();
    const selection = this.state.editorState.getSelection();
    const firstFocusOffset = state.getSelection().getEndOffset();
    const firstAnchorOffset =
      firstFocusOffset - this.state.autoSuggest.content.length - 1;
    let focusOffset = firstFocusOffset;
    let anchorOffset = firstAnchorOffset;
    let newContent = content;

    newContent = Modifier.replaceText(
      newContent,
      selection.merge({
        anchorOffset: anchorOffset,
        focusOffset: focusOffset,
      }),
      ""
    );

    let oldLength = 0;
    selectedChoice.sentence.sentence_elements.forEach((element, index) => {
      if (index > 100) return;
      let text = "";
      let length = text.length;
      if (".|,|:|;".includes(element.value.charAt(0))) {
        text = element.value;
      } else if (index === 0) {
        text = element.value;
      } else {
        text = `${element.value}`;

        newContent = Modifier.insertText(
          newContent,
          selection.merge({
            anchorOffset: anchorOffset + oldLength,
            focusOffset: anchorOffset + oldLength,
          }),
          " "
        );
        ++anchorOffset;
      }
      length = text.length;

      if (index === 0) {
        oldLength = length;
      } else {
        anchorOffset += oldLength;
        oldLength = length;
      }

      if (element.type === "input") {
        newContent = Modifier.replaceText(
          newContent,
          selection.merge({
            anchorOffset: anchorOffset,
            focusOffset: anchorOffset,
          }),
          text,
          ["BOLD"]
        );
      } else {
        newContent = Modifier.insertText(
          newContent,
          selection.merge({
            anchorOffset: anchorOffset,
            focusOffset: anchorOffset,
          }),
          text
        );
      }
    });

    let newEditorState = EditorState.push(
      this.state.editorState,
      newContent,
      "insert-characters"
    );

    newEditorState = EditorState.forceSelection(
      newEditorState,
      selection.merge({
        anchorOffset: firstAnchorOffset,
        focusOffset: firstAnchorOffset,
      })
    );

    newEditorState = this.highlightFirst(newEditorState);

    this.onEditorChange(newEditorState);

    setTimeout(() => {
      this.hiddenAutosuggest();
      this.focus();
    });
  };

  _addEmptyBlock = (editorState) => {
    const newBlock = new ContentBlock({
      key: genKey(),
      type: "unstyled",
      text: "",
      characterList: List(),
    });

    const contentState = editorState.getCurrentContent();
    const newBlockMap = contentState.getBlockMap().set(newBlock.key, newBlock);

    return EditorState.push(
      editorState,
      ContentState.createFromBlockArray(newBlockMap.toArray())
        .set("selectionBefore", contentState.getSelectionBefore())
        .set("selectionAfter", contentState.getSelectionAfter())
    );
  };

  _autoSelectFirstOption = () => {
    const option = this.selectRef.current.getOptionFocused();

    if (option) {
      this.onChoiceSelect(option);
      setTimeout(() => {
        this.hiddenAutosuggest();
      });
    }
  };

  _onEditorChange = (editorState) => {
    this.setState({ editorState });
  };

  _showAutosuggest = () => {
    const position = getCursorPosition(this.state.editorState);
    if (position) this.setState({ autosuggestPosition: { ...position } });
    setTimeout(() => {
      this.setState({
        autoSuggest: { content: "", enable: true },
      });
    }, 100);
  };

  _hiddenAutosuggest = () => {
    this.setState({
      autoSuggest: { content: "", enable: false },
      editorState: this.state.editorState,
    });
  };

  _createCharacterBlock = (string = "") => {
    const selectionState = this.state.editorState.getSelection();
    const contentState = this.state.editorState.getCurrentContent();
    const newContentState = contentState.createEntity("SPAN", "MUTABLE", {});
    const entityKey = newContentState.getLastCreatedEntityKey();
    const startKey = selectionState.getStartOffset();
    const endKey = selectionState.getEndOffset();
    let newEditorState = this.state.editorState;

    if (startKey === endKey) {
      const newContentStateWithText = Modifier.insertText(
        newContentState,
        selectionState,
        string,
        null,
        entityKey
      );

      newEditorState = EditorState.push(
        this.state.editorState,
        newContentStateWithText,
        "insert-characters"
      );
    } else {
      const newContentStateWithText = Modifier.replaceText(
        newContentState,
        selectionState,
        string,
        null,
        entityKey
      );

      newEditorState = EditorState.push(
        this.state.editorState,
        newContentStateWithText,
        "insert-characters"
      );
    }

    this.onEditorChange(newEditorState);
  };

  _highlightFirst = (editorState) => {
    const selection = editorState.getSelection();
    const contentState = editorState.getCurrentContent();
    let block = contentState.getBlockForKey(selection.getStartKey());
    let newSelection = selection;
    let count = 0;
    let targetOffsetStart = null;
    let targetOffsetEnd = 0;
    let startIndex = selection.getStartOffset();
    let text = block.getText();

    for (let i = startIndex; i <= text.length; i++) {
      let style = block.getInlineStyleAt(i).toString();
      if (style.indexOf("BOLD") === -1) {
        if (count === 1) {
          targetOffsetEnd = i === 0 ? text.length : i;
          newSelection = selection.merge({
            anchorOffset: targetOffsetStart,
            focusOffset: targetOffsetEnd,
            anchorKey: block.key,
            focusKey: block.key,
          });

          return EditorState.forceSelection(editorState, newSelection);
        }
      }
      if (style.indexOf("BOLD") !== -1) {
        if (targetOffsetStart === null) {
          targetOffsetStart = i;
          count = 1;
        }
      }
    }

    return editorState;
  };

  render() {
    const { editorState, autoSuggest } = this.state;
    // If the user changes block type before entering any text, we can
    // either style the placeholder or hide it. Let's just hide it now.
    let className = "RichEditor-editor";
    var contentState = editorState.getCurrentContent();
    if (!contentState.hasText()) {
      if (contentState.getBlockMap().first().getType() !== "unstyled") {
        className += " RichEditor-hidePlaceholder";
      }
    }

    const handleBeforeInput = (char) => {
      if (autoSuggest.enable) {
        const content = autoSuggest.content + char;
        this.setState({ autoSuggest: { ...autoSuggest, content } });
      }
    };

    return (
      <>
        <div
          className="RichEditor-root"
          style={{
            position: "relative",
          }}
        >
          <BlockStyleControls
            editorState={editorState}
            onToggle={this.toggleBlockType}
          />
          <InlineStyleControls
            editorState={editorState}
            onToggle={this.toggleInlineStyle}
          />
          <div
            className={className}
            style={{
              position: "relative",
            }}
          >
            <Editor
              ref={this.editorRef}
              blockStyleFn={getBlockStyle}
              customStyleMap={styleMap}
              editorState={editorState}
              handleKeyCommand={this.handleKeyCommand}
              keyBindingFn={this.mapKeyToEditorCommand}
              placeholder="Tell a story..."
              spellCheck={true}
              onChange={this.onEditorChange}
              plugins={plugins}
              handleBeforeInput={(char, editorState) =>
                handleBeforeInput(char, editorState)
              }
            />
          </div>
            <div
              style={{
                width: "500px",
                position: "absolute",
                zIndex: 1000,
                top: this.state.autosuggestPosition.top + 15,
                left: this.state.autosuggestPosition.left,
              }}
            >
              {autoSuggest.enable && (
                <CustomSelect
                  ref={this.selectRef}
                  inputValue={autoSuggest.content}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      this.hiddenAutosuggest();
                    }
                  }}
                  options={choices.map((option) => ({
                    value: option.sentence_id,
                    label: option.sentence_name,
                    sentence: option,
                  }))}
                  onChange={this.onChoiceSelect}
                />
              )}
            </div>
        </div>
      </>
    );
  }
}

const CustomSelect = forwardRef(({ inputValue, options, ...rest }, ref) => {
  const [COptions, setCOption] = useState(options);
  const [optionSelectIndex, setOptionSelectIndex] = useState(0);
  const selectRef = useRef();

  const filterOption = (input) => {
    const filteredItems = options.filter((option) =>
      option.label.toLowerCase().match(input.toLowerCase())
    );
    setOptionSelectIndex(0);
    setCOption(filteredItems);
  };

  const focusOption = (string) => {
    if (string === "up" || string === "down") {
      selectRef.current.focusOption(string);

      if (string === "up") {
        const index =
          optionSelectIndex === 0 ? COptions.length - 1 : optionSelectIndex - 1;
        setOptionSelectIndex(index);
      }

      if (string === "down") {
        const index =
          optionSelectIndex === COptions.length - 1 ? 0 : optionSelectIndex + 1;
        setOptionSelectIndex(index);
      }
    }
  };

  useImperativeHandle(ref, () => ({
    getFilteredOptions: () => COptions,
    focusOption,
    getOptionFocused: () => {
      try {
        return COptions.find(option => option.label === selectRef.current?.focusedOptionRef?.outerText);
      } catch (_) {
        return null;
      }
    },
    ...selectRef.current,
  }));

  useEffect(() => {
    filterOption(inputValue);
  }, [inputValue]);

  return (
    <Select
      ref={selectRef}
      blockOptionHover={true}
      inputProps={{ readOnly: true }}
      menuIsOpen
      styles={{
        control: () => ({
          maxHeight: "0px",
          overflow: "hidden",
        }),
      }}
      options={COptions}
      {...rest}
    />
  );
});

// Custom overrides for "code" style.
const styleMap = {
  CODE: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    fontFamily: '"Inconsolata", "Menlo", "Consolas", monospace',
    fontSize: 16,
    padding: 2,
  },
};

function getBlockStyle(block) {
  switch (block.getType()) {
    case "blockquote":
      return "RichEditor-blockquote";
    default:
      return null;
  }
}

class StyleButton extends React.Component {
  constructor() {
    super();
    this.onToggle = (e) => {
      e.preventDefault();
      this.props.onToggle(this.props.style);
    };
  }

  render() {
    let className = "RichEditor-styleButton";
    if (this.props.active) {
      className += " RichEditor-activeButton";
    }

    return (
      <span className={className} onMouseDown={this.onToggle}>
        {this.props.label}
      </span>
    );
  }
}

const BLOCK_TYPES = [
  { label: "H1", style: "header-one" },
  { label: "H2", style: "header-two" },
  { label: "H3", style: "header-three" },
  { label: "H4", style: "header-four" },
  { label: "H5", style: "header-five" },
  { label: "H6", style: "header-six" },
  { label: "Blockquote", style: "blockquote" },
  { label: "UL", style: "unordered-list-item" },
  { label: "OL", style: "ordered-list-item" },
  { label: "Code Block", style: "code-block" },
];

const BlockStyleControls = (props) => {
  const { editorState } = props;
  const selection = editorState.getSelection();
  const blockType = editorState
    .getCurrentContent()
    .getBlockForKey(selection.getStartKey())
    .getType();

  return (
    <div className="RichEditor-controls">
      {BLOCK_TYPES.map((type) => (
        <StyleButton
          key={type.label}
          active={type.style === blockType}
          label={type.label}
          onToggle={props.onToggle}
          style={type.style}
        />
      ))}
    </div>
  );
};

var INLINE_STYLES = [
  { label: "Bold", style: "BOLD" },
  { label: "Italic", style: "ITALIC" },
  { label: "Underline", style: "UNDERLINE" },
  { label: "Monospace", style: "CODE" },
];

const InlineStyleControls = (props) => {
  const currentStyle = props.editorState.getCurrentInlineStyle();

  return (
    <div className="RichEditor-controls">
      {INLINE_STYLES.map((type) => (
        <StyleButton
          key={type.label}
          active={currentStyle.has(type.style)}
          label={type.label}
          onToggle={props.onToggle}
          style={type.style}
        />
      ))}
    </div>
  );
};

export default RichTextEditor;
