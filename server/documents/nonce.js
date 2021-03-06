// This is a server-only collection. So we do not use Meteor methods at all.

import {Match} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {BaseDocument} from '/lib/base';
import {check} from '/server/check';

export class Nonce extends BaseDocument {
  // _id: ID of the document
  // nonce: unique nonce to be stored

  static addNonce(args) {
    check(args, {
      nonce: Match.NonEmptyString,
    });

    return Nonce.documents.insert({
      nonce: args.nonce,
    });
  }
}

Nonce.Meta({
  name: 'Nonce',
});

if (Meteor.isServer) {
  Nonce.Meta.collection._ensureIndex({
    nonce: 1,
  }, {
    unique: true,
  });
}
