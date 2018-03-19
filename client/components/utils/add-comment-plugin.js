import {Plugin} from "prosemirror-state";

class AddComment {
  constructor(view, vueInstance) {
    view.dom.parentNode.appendChild(vueInstance.$refs.addCommentButton.$el);
    this.update(view, null);
    this.vueInstance = vueInstance;
  }

  /**
   * Function that is being called with every action from the editor, here we
   * check if a selection was made and show the "Add Comment" button.
   * @param {F} view - EditorView from ProseMirror
   * @param {*} lastState - Previous State
   */
  update(view, lastState) {
    const {state} = view;
    const {selection} = state;
    if (
      (lastState &&
      lastState.doc.eq(state.doc) &&
      lastState.selection.eq(state.selection)) ||
      !this.vueInstance) {
      return;
    }

    const marks = [];
    state.doc.nodesBetween(selection.from, selection.to, (node, start, parent, index) => {
      marks.push({marks: node.marks, start, size: node.nodeSize});
    });
    marks.shift(); // the first element always comes empty, so we remove it
    let onlyCommentMarkInRange = true;
    marks.forEach((marksObj) => {
      if (!marksObj.marks.length) {
        onlyCommentMarkInRange = false;
      }
      if (marksObj.marks.filter((m) => {
        return m.type.name !== 'comment';
      }).length) {
        onlyCommentMarkInRange = false;
      }
    });
    this.vueInstance.selectedExistingComments = marks.filter((marksObj) => {
      return marksObj.marks.length;
    }).map((marksObj) => {
      return Object.assign({}, marksObj, {
        marks: marksObj.marks.filter((m) => {
          return m.type.name === "comment";
        }),
      });
    });
    const button = this.vueInstance.$refs.addCommentButton;
    // Hide the comment button if the selection is empty or the selection
    // only contains comment marks.
    if (state.selection.empty || onlyCommentMarkInRange) {
      button.$el.style.opacity = 0;
      button.$el.style.visibility = 'hidden';
      return;
    }

    button.$el.style.opacity = 0.75;
    button.$el.style.visibility = 'visible';
    const {from} = state.selection;
    // These are in screen coordinates
    const start = view.coordsAtPos(from);
    // The box in which the comment button is positioned, to use as base
    const box = button.$el.offsetParent.getBoundingClientRect();
    button.$el.style.bottom = `${(box.bottom - start.bottom)}px`;
  }
}

export default function addCommentPlugin(vueInstance) {
  return new Plugin({
    view(editorView) {
      return new AddComment(editorView, vueInstance);
    },
  });
}

export function addComment(keys, schema, state, from, to, dispatch) {
  const {doc, tr} = state;
  let attrs = null;
  if (!doc.rangeHasMark(from, to, schema.marks.comment)) {
    attrs = {"data-highlight-keys": keys};
    if (!attrs["data-highlight-keys"]) {
      return false;
    }
  }
  return dispatch(tr.addMark(from, to, schema.marks.comment.create(attrs)));
}

export function removeComment(schema, state, from, to, dispatch) {
  const {doc, tr} = state;
  if (dispatch) {
    if (doc.rangeHasMark(from, to, schema.marks.comment)) {
      return dispatch(tr.removeMark(from, to, schema.marks.comment));
    }
  }
  return null;
}

export function updateChunks(previousChunks, splitChunk, {from, to}) {
  let chunk1 = null;
  let chunk3 = null;
  if (splitChunk.from < from) {
    chunk1 = {
      from: splitChunk.from,
      to: from,
      empty: true,
    };
  }
  const chunk2 = {
    from,
    to,
    empty: false,
  };
  if (splitChunk.to > to) {
    chunk3 = {
      from: to,
      to: splitChunk.to,
      empty: true,
    };
  }

  const index = previousChunks.indexOf(splitChunk);
  const newChunks = previousChunks;
  newChunks.splice(index, 1);
  if (chunk1) {
    newChunks.splice(index, 0, chunk1);
  }

  newChunks.splice(index + 1, 0, chunk2);

  if (chunk3) {
    newChunks.splice(index + 2, 0, chunk3);
  }

  return newChunks;
}
