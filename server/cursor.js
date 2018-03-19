import {check, Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Cursor} from '/lib/cursor';
import {User} from '/lib/user';
import randomColor from 'randomcolor';

// Server-side only method, so we are not using ValidatedMethod.
Meteor.methods({
  'Cursor.update'(args) {
    check(args, {
      contentKey: Match.DocumentId,
      clientId: Match.DocumentId,
      head: Match.Integer,
      ranges: [{beginning: Match.Integer, end: Match.Integer}],
    });

    const user = Meteor.user(User.REFERENCE_FIELDS());
    if (!user) {
      throw new Meteor.Error('unauthorized', "Unauthorized.");
    }

    // TODO: Check more permissions?

    Cursor.documents.update(
      {
        contentKey: args.contentKey,
        clientId: args.clientId,
        connectionId: this.connection.id,
      },
      {
        $set: {
          head: args.head,
          ranges: args.ranges,
        },
        $setOnInsert: {
          createdAt: new Date(),
          author: user.getReference(),
          color: randomColor(),
        },
      },
      {
        upsert: true,
      },
    );
  },
});

// TODO: Publish only cursors which are not for the current connection.
Meteor.publish('Cursor.list', function cursorList(args) {
  check(args, {
    contentKey: Match.DocumentId,
  });

  this.enableScope();

  return Cursor.documents.find({
    contentKey: args.contentKey,
  }, {
    fields: Cursor.PUBLISH_FIELDS(),
  });
});

const connectionIds = new Set();

Meteor.onConnection((connection) => {
  connectionIds.add(connection.id);

  connection.onClose(() => {
    Cursor.documents.remove({
      connectionId: connection.id,
    });
    connectionIds.delete(connection.id);
  });
});

const connectionsCleanup = Meteor.bindEnvironment(() => {
  for (const connectionId of connectionIds) {
    Cursor.documents.remove({
      connectionId,
    });
    connectionIds.delete(connectionId);
  }
});

process.once('exit', connectionsCleanup);
process.once('SIGTERM', connectionsCleanup);
process.once('SIGINT', connectionsCleanup);
