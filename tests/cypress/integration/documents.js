/* eslint-env cypress/globals */
/* eslint-disable func-names, prefer-arrow-callback */

describe('documents', function () {
  it('can create a document', function () {
    cy.visit('/');

    cy.visualSnapshot(this.test, 'initial');

    cy.resetDatabase();

    // TODO: Make into a Cypress custom command.
    cy.window().then((window) => {
      window.require('/lib/documents/user').User.passwordlessSignIn({username: 'testuser'});
      cy.get('nav.v-toolbar .v-menu__activator').should('contain', 'testuser');
    });

    cy.get('.v-btn').contains('Documents').click();

    cy.location('pathname').should('eq', '/document');

    cy.get('div.v-card__text').contains('No documents.');

    cy.visualSnapshot(this.test, 'documents');

    // No idea why we need force, but it complains without.
    cy.get('.v-btn').contains('New document').click({force: true});

    cy.get('.v-snack__content').should('contain', 'New document has been created.').contains('Close').click();

    cy.get('h1[data-text="Write the title of your document here"]');

    cy.visualSnapshot(this.test, 'document made');

    cy.window().then((window) => {
      cy.get('p[data-text="Add the text of your document here"]').then(($el) => {
        const el = $el.get(0);
        const range = window.document.createRange();
        range.setStart(el, 0);
        range.setEnd(el, 0);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });
    });

    cy.visualSnapshot(this.test, 'focused');

    cy.window().then((window) => {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(window.document.createTextNode('test'));
    });

    cy.wait(500);

    cy.visualSnapshot(this.test, 'added text');

    cy.get('button[title="Bold (Ctrl-B)"]').click();

    cy.wait(500);

    cy.visualSnapshot(this.test, 'bold');

    cy.location('pathname').then((path) => {
      const match = path.match(/\/document\/(.*)/);

      assert.isNotNull(match);

      cy.call('_test.documentFind', {_id: match[1]}).then((documents) => {
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
              marks: [{
                type: 'strong',
              }],
            }],
          }],
        });
      });
    });
  });

  it('can see history', function () {
    cy.visit('/document');

    cy.resetDatabase();

    // TODO: Make into a Cypress custom command.
    cy.window().then((window) => {
      window.require('/lib/documents/user').User.passwordlessSignIn({username: 'testuser'});
      cy.get('nav.v-toolbar .v-menu__activator').should('contain', 'testuser');
    });

    cy.get('div.v-card__text').contains('No documents.');

    // No idea why we need force, but it complains without.
    cy.get('.v-btn').contains('New document').click({force: true});

    cy.get('.v-snack__content').should('contain', 'New document has been created.').contains('Close').click();

    cy.get('.editor').type('first paragraph');
    cy.get('.editor').type('{enter}');
    cy.get('.editor').type('second paragraph');
    cy.get('.editor').type('{enter}');
    cy.get('.editor').type('{enter}');
    cy.get('.editor').type('third paragraph');

    cy.wait(500);

    cy.window().then((window) => {
      cy.contains('.editor p', 'second paragraph').then(($el) => {
        const el = $el.get(0);
        const range = window.document.createRange();
        range.selectNode(el);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        range.deleteContents();
      });
    });

    cy.wait(500);

    cy.visualSnapshot(this.test, 'test content');

    cy.location('pathname').then((path) => {
      const match = path.match(/\/document\/(.*)/);

      assert.isNotNull(match);

      cy.call('_test.documentFind', {_id: match[1]}).then((documents) => {
        assert.equal(documents.length, 1);
        assert.deepEqual(documents[0].body, {
          type: 'doc',
          content: [{
            type: 'title',
          }, {
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'first paragraph',
            }],
          }, {
            type: 'paragraph',
          }, {
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'third paragraph',
            }],
          }],
        });

        cy.call('_test.contentFind', {contentKeys: documents[0].contentKey}, {sort: {version: 1}}).then((contents) => {
          assert.equal(contents.length, 51);
          // We backdate some steps for 20 minutes to have two sets of changes in the history view.
          for (let i = 0; i <= 32; i += 1) {
            cy.call('_test.contentUpdate', {_id: contents[i]._id}, {$set: {createdAt: new contents[i].createdAt.constructor(contents[i].createdAt.valueOf() - (20 * 60 * 1000))}});
          }
        });
      });
    });

    cy.wait(500);

    cy.get('.v-btn').contains('History').click({force: true});

    cy.visualSnapshot(this.test, 'initial history');

    cy.get('.v-timeline-item__body .v-card__text').eq(1).click();

    cy.visualSnapshot(this.test, 'second change');

    cy.get('.v-timeline-item__body .v-card__text').eq(0).trigger('click', {shiftKey: true});

    cy.visualSnapshot(this.test, 'both changes');
  });
});
