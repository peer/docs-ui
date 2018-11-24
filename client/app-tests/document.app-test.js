/* eslint-env mocha */
/* eslint-disable func-names, prefer-arrow-callback */

import {Random} from 'meteor/random';
import {_} from 'meteor/underscore';

import {assert} from 'chai';
import {rebaseSteps} from 'prosemirror-collab';
import {Step, Transform} from 'prosemirror-transform';

import {Content} from '/lib/documents/content';
import {Document} from '/lib/documents/document';
import {User} from '/lib/documents/user';
import {schema} from '/lib/full-schema';
import {documentFind, waitForDatabase} from '/lib/utils.app-test';

// Augment "User" class.
import '../auth-passwordless';

const INITIAL_STEPS = [{
  stepType: 'replace',
  from: 3,
  to: 3,
  slice: {
    content: [{
      type: 'text',
      text: 't',
    }],
  },
}, {
  stepType: 'replace',
  from: 4,
  to: 4,
  slice: {
    content: [{
      type: 'text',
      text: 'e',
    }],
  },
}, {
  stepType: 'replace',
  from: 5,
  to: 5,
  slice: {
    content: [{
      type: 'text',
      text: 's',
    }],
  },
}, {
  stepType: 'replace',
  from: 6,
  to: 6,
  slice: {
    content: [{
      type: 'text',
      text: 't',
    }],
  },
}];

const FORK1_STEPS = [{
  stepType: 'replace',
  from: 7,
  to: 7,
  slice: {
    content: [{
      type: 'text',
      text: '.',
    }],
  },
}, {
  stepType: 'replace',
  from: 8,
  to: 8,
  slice: {
    content: [{
      type: 'text',
      text: ' ',
    }],
  },
}, {
  stepType: 'replace',
  from: 9,
  to: 9,
  slice: {
    content: [{
      type: 'text',
      text: 'f',
    }],
  },
}, {
  stepType: 'replace',
  from: 10,
  to: 10,
  slice: {
    content: [{
      type: 'text',
      text: 'o',
    }],
  },
}, {
  stepType: 'replace',
  from: 11,
  to: 11,
  slice: {
    content: [{
      type: 'text',
      text: 'o',
    }],
  },
}];

const FORK2_STEPS = [{
  stepType: 'replace',
  from: 3,
  to: 4,
  slice: {
    content: [{
      type: 'text',
      text: 'T',
    }],
  },
}, {
  stepType: 'replace',
  from: 4,
  to: 4,
  slice: {
    content: [{
      type: 'text',
      text: 'E',
    }],
  },
}, {
  stepType: 'replace',
  from: 5,
  to: 5,
  slice: {
    content: [{
      type: 'text',
      text: 'S',
    }],
  },
}, {
  stepType: 'replace',
  from: 6,
  to: 6,
  slice: {
    content: [{
      type: 'text',
      text: 'T',
    }],
  },
}];

const FINAL_CONTENT = {
  type: 'doc',
  content: [{
    type: 'title',
  }, {
    type: 'paragraph',
    content: [{
      type: 'text',
      text: 'TESTest. foo',
    }],
  }],
};

describe('document', function () {
  this.timeout(10000);

  const username = `user${Random.id()}`;

  before(async function () {
    await User.passwordlessSignIn({username});

    const {contentKey, _id: documentId} = await Document.create({});

    this.contentKey = contentKey;
    this.documentId = documentId;
  });

  it('can be populated with content', async function () {
    const clientId = Random.id();

    const changes = await Content.addSteps({
      clientId,
      contentKey: this.contentKey,
      currentVersion: 0,
      steps: INITIAL_STEPS,
    });

    assert.equal(changes, 4);

    const documents = await documentFind({_id: this.documentId});

    assert.equal(documents.length, 1);
    assert.deepEqual(documents[0].body, {
      type: 'doc',
      content: [{
        type: 'title',
      }, {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'test',
        }],
      }],
    });
  });

  it('cannot be forked if it is not published', async function () {
    try {
      await Document.fork({
        documentId: this.documentId,
      });
      assert.fail();
    }
    catch (err) {
      assert.equal(err.error, 'not-found');
    }
  });

  it('cannot be merged if it is not forked', async function () {
    try {
      await Document.acceptMerge({
        documentId: this.documentId,
      });
      assert.fail();
    }
    catch (err) {
      assert.equal(err.error, 'not-found');
    }
  });

  it('can be published', async function () {
    let [document] = await documentFind({_id: this.documentId});

    assert.equal(document.publishedBy, null);
    assert.equal(document.publishedAt, null);
    assert.equal(document.publishedAtVersion, null);

    const changed = await Document.publish({
      documentId: this.documentId,
    });

    assert.equal(changed, 1);

    [document] = await documentFind({_id: this.documentId});

    assert.notEqual(document.publishedBy, null);
    assert.notEqual(document.publishedAt, null);
    assert.notEqual(document.publishedAtVersion, null);
  });

  it('can be forked if it is published', async function () {
    // Create two forks from parent document.
    const {_id: fork1Id} = await Document.fork({
      documentId: this.documentId,
    });

    const {_id: fork2Id} = await Document.fork({
      documentId: this.documentId,
    });

    const forkedDocuments = await documentFind({'forkedFrom._id': this.documentId});

    assert.include(_.pluck(forkedDocuments, '_id'), fork1Id);
    assert.include(_.pluck(forkedDocuments, '_id'), fork2Id);

    forkedDocuments.forEach((x) => {
      assert.equal(x.forkedFrom._id, this.documentId);
      assert.equal(x.forkedAtVersion, 4);
      assert.equal(x.rebasedAtVersion, 4);
      assert.equal(x.version, 4);
    });
  });

  it('can be merged', async function () {
    // Obtain parent document forks.
    let [fork1, fork2] = await documentFind({'forkedFrom._id': this.documentId});

    [fork1, fork2].forEach((x) => {
      assert.equal(x.mergeAcceptedBy, null);
      assert.equal(x.mergeAcceptedAt, null);
      assert.equal(x.mergeAcceptedAtVersion, null);
      assert.equal(x.forkedFrom._id, this.documentId);
      assert.equal(x.forkedAtVersion, 4);
      assert.equal(x.rebasedAtVersion, 4);
      assert.equal(x.version, 4);
    });

    const clientId = Random.id();

    // Add steps to fork1.
    await Content.addSteps({
      clientId,
      contentKey: fork1.contentKey,
      currentVersion: fork1.version,
      steps: FORK1_STEPS,
    });

    [fork1] = await documentFind({_id: fork1._id});

    assert.equal(fork1.mergeAcceptedBy, null);
    assert.equal(fork1.mergeAcceptedAt, null);
    assert.equal(fork1.mergeAcceptedAtVersion, null);
    assert.equal(fork1.forkedFrom._id, this.documentId);
    assert.equal(fork1.forkedAtVersion, 4);
    assert.equal(fork1.rebasedAtVersion, 4);
    assert.equal(fork1.version, 9);

    // Add steps to fork2.
    await Content.addSteps({
      clientId,
      contentKey: fork2.contentKey,
      currentVersion: fork2.version,
      steps: FORK2_STEPS,
    });

    [fork2] = await documentFind({_id: fork2._id});

    assert.equal(fork2.mergeAcceptedBy, null);
    assert.equal(fork2.mergeAcceptedAt, null);
    assert.equal(fork2.mergeAcceptedAtVersion, null);
    assert.equal(fork2.forkedFrom._id, this.documentId);
    assert.equal(fork2.forkedAtVersion, 4);
    assert.equal(fork2.rebasedAtVersion, 4);
    assert.equal(fork2.version, 8);

    // Merge fork1 into the parent document.
    await Document.acceptMerge({
      documentId: fork1._id,
    });

    // Wait for Scheduled rebaseSteps.
    await new Promise((resolve) => {
      return setTimeout(resolve, 1100);
    });

    await waitForDatabase();

    [fork1] = await documentFind({_id: fork1._id});

    assert.notEqual(fork1.mergeAcceptedBy, null);
    assert.notEqual(fork1.mergeAcceptedAt, null);
    assert.equal(fork1.mergeAcceptedAtVersion, 9);
    assert.equal(fork1.forkedFrom._id, this.documentId);
    assert.equal(fork1.forkedAtVersion, 4);
    assert.equal(fork1.rebasedAtVersion, 4);
    assert.equal(fork1.version, 9);

    let [parentDocument] = await documentFind({_id: this.documentId});

    assert.deepEqual(parentDocument.body, {
      type: 'doc',
      content: [{
        type: 'title',
      }, {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'test. foo',
        }],
      }],
    });

    assert.equal(parentDocument.version, 9);

    [fork2] = await documentFind({_id: fork2._id});

    assert.equal(fork2.mergeAcceptedBy, null);
    assert.equal(fork2.mergeAcceptedAt, null);
    assert.equal(fork2.mergeAcceptedAtVersion, null);
    assert.equal(fork2.forkedFrom._id, this.documentId);
    assert.equal(fork2.forkedAtVersion, 4);
    assert.equal(fork2.rebasedAtVersion, 9);
    assert.equal(fork2.version, 13);

    // Previous additional step on top of fork2 should be now rebased.
    assert.deepEqual(fork2.body, FINAL_CONTENT);

    // Add steps to fork2.
    await Content.addSteps({
      clientId,
      contentKey: fork2.contentKey,
      currentVersion: fork2.version,
      steps: [{
        stepType: 'replace',
        from: 4,
        to: 4,
        slice: {
          content: [{
            type: 'text',
            text: 'X',
          }],
        },
      }],
    });

    [fork2] = await documentFind({_id: fork2._id});

    assert.equal(fork2.mergeAcceptedBy, null);
    assert.equal(fork2.mergeAcceptedAt, null);
    assert.equal(fork2.mergeAcceptedAtVersion, null);
    assert.equal(fork2.forkedFrom._id, this.documentId);
    assert.equal(fork2.forkedAtVersion, 4);
    assert.equal(fork2.rebasedAtVersion, 9);
    assert.equal(fork2.version, 14);

    // Merge fork2 into parent document.
    await Document.acceptMerge({
      documentId: fork2._id,
    });

    // Wait for Scheduled rebaseSteps.
    await new Promise((resolve) => {
      return setTimeout(resolve, 1100);
    });

    await waitForDatabase();

    // Nothing changes for fork1.
    [fork1] = await documentFind({_id: fork1._id});

    assert.notEqual(fork1.mergeAcceptedBy, null);
    assert.notEqual(fork1.mergeAcceptedAt, null);
    assert.equal(fork1.mergeAcceptedAtVersion, 9);
    assert.equal(fork1.forkedFrom._id, this.documentId);
    assert.equal(fork1.forkedAtVersion, 4);
    assert.equal(fork1.rebasedAtVersion, 4);
    assert.equal(fork1.version, 9);

    [fork2] = await documentFind({_id: fork2._id});

    assert.notEqual(fork2.mergeAcceptedBy, null);
    assert.notEqual(fork2.mergeAcceptedAt, null);
    assert.equal(fork2.mergeAcceptedAtVersion, 14);
    assert.equal(fork2.forkedFrom._id, this.documentId);
    assert.equal(fork2.forkedAtVersion, 4);
    assert.equal(fork2.rebasedAtVersion, 9);
    assert.equal(fork2.version, 14);

    [parentDocument] = await documentFind({_id: this.documentId});

    assert.deepEqual(parentDocument.body, {
      type: 'doc',
      content: [{
        type: 'title',
      }, {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'TXESTest. foo',
        }],
      }],
    });

    assert.equal(parentDocument.version, 14);
  });

  it('cannot be merged if it is published', async function () {
    const {_id: forkId} = await Document.fork({
      documentId: this.documentId,
    });

    const changed = await Document.publish({
      documentId: forkId,
    });

    assert.equal(changed, 1);

    try {
      await Document.acceptMerge({
        documentId: forkId,
      });
      assert.fail();
    }
    catch (err) {
      assert.equal(err.error, 'not-found');
    }
  });

  it('cannot be published if it is merged', async function () {
    const {_id: forkId} = await Document.fork({
      documentId: this.documentId,
    });

    await Document.acceptMerge({
      documentId: forkId,
    });

    const changed = await Document.publish({
      documentId: forkId,
    });
    assert.equal(changed, 0);
  });

  it('is compatible with collab rebase', async function () {
    const doc = schema.topNodeType.createAndFill();
    const transform = new Transform(doc);
    const transformFork1 = new Transform(doc);

    const initialSteps = [];
    for (const step of INITIAL_STEPS) {
      initialSteps.push(Step.fromJSON(schema, step));
      transform.step(initialSteps[initialSteps.length - 1]);
      transformFork1.step(initialSteps[initialSteps.length - 1]);
    }

    assert.deepEqual(transform.doc.toJSON(), {
      type: 'doc',
      content: [{
        type: 'title',
      }, {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'test',
        }],
      }],
    });

    assert.deepEqual(transformFork1.doc.toJSON(), {
      type: 'doc',
      content: [{
        type: 'title',
      }, {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'test',
        }],
      }],
    });

    const fork2steps = [];
    for (const step of FORK2_STEPS) {
      fork2steps.push(Step.fromJSON(schema, step));
      transform.step(fork2steps[fork2steps.length - 1]);
    }

    assert.deepEqual(transform.doc.toJSON(), {
      type: 'doc',
      content: [{
        type: 'title',
      }, {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'TESTest',
        }],
      }],
    });

    const fork1steps = [];
    for (const step of FORK1_STEPS) {
      fork1steps.push(Step.fromJSON(schema, step));
      transformFork1.step(fork1steps[fork1steps.length - 1]);
    }

    assert.deepEqual(transformFork1.doc.toJSON(), {
      type: 'doc',
      content: [{
        type: 'title',
      }, {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'test. foo',
        }],
      }],
    });

    // We have to make another transform for rebasing to work correctly.
    // See: https://github.com/ProseMirror/prosemirror/issues/874
    // TODO: Remove in the future if this is fixed in ProseMirror.
    const rebaseTransform = new Transform(transform.doc);

    rebaseSteps(fork2steps.map((s, i) => {
      return {
        step: s,
        inverted: s.invert(transform.docs[initialSteps.length + i]),
      };
    }), fork1steps, rebaseTransform);

    assert.deepEqual(rebaseTransform.doc.toJSON(), FINAL_CONTENT);
  });
});
