import {Plugin} from "prosemirror-state";
import {setBlockType, toggleMark} from "prosemirror-commands";

class MenuView {
  constructor(items, editorView) {
    this.items = items;
    this.editorView = editorView;
    this.dom = document.getElementById("tools");
    this.update();

    this.dom.addEventListener("mousedown", (e) => {
      e.preventDefault();
      editorView.focus();
      items.forEach(({command, dom}) => {
        if (dom.contains(e.target)) {
          command(editorView.state, editorView.dispatch, editorView);
        }
      });
    });
  }

  update() {
    const {state} = this.editorView;
    const {selection} = state;
    this.items.forEach(({
      command, dom, node, mark, attr,
    }) => {
      let active = false;
      let btnClass = dom.className.replace(' btn--active', '').replace(' btn--disabled', '');
      if (mark) {
        active = state.doc.rangeHasMark(selection.from, selection.to, mark);
      }
      else if (node) {
        for (let i = 0; i < selection.$from.path.length; i += 1) {
          if (typeof selection.$from.path[i] !== 'number' && selection.$from.path[i].hasMarkup(node, attr)) {
            active = true;
            break;
          }
        }
      }

      const enabled = command(state, null, this.editorView);

      if (!enabled) {
        btnClass += " btn--disabled";
      }

      if (active) {
        btnClass += " btn--active";
      }

      dom.className = btnClass; // eslint-disable-line no-param-reassign
    });
  }

  destroy() {
    this.dom.remove();
  }
}


export function menuPlugin(items) {
  return new Plugin({
    view(editorView) {
      const menuView = new MenuView(items, editorView);
      editorView.dom.parentNode.insertBefore(menuView.dom, editorView.dom);
      return menuView;
    },
  });
}

export function icon(text, name) {
  const span = document.createElement("span");
  span.className = `menuicon ${name}`;
  span.title = name;
  span.textContent = text;
  return span;
}

export function heading(level, schema) {
  return {
    command: setBlockType(schema.nodes.heading, {level}),
    dom: document.getElementById(`h${level}`),
    node: schema.nodes.heading,
    attr: {level},
  };
}

export function toggleLink(schema) {
  return function onToggle(state, dispatch) {
    const {doc, selection} = state;
    if (selection.empty) {
      return false;
    }
    let attrs = null;
    if (dispatch) {
      if (!doc.rangeHasMark(selection.from, selection.to, schema.marks.link)) {
        attrs = {href: prompt("Link to where?", "")};
        if (!attrs.href) {
          return false;
        }
      }
    }
    return toggleMark(schema.marks.link, attrs)(state, dispatch);
  };
}
