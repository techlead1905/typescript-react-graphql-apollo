'use strict';

require('dotenv').config();
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import graphqlHTTP from 'express-graphql';
import gql from 'graphql-tag';
import path from 'path';
import { buildASTSchema } from 'graphql';
import { Db, MongoClient, AggregationCursor } from 'mongodb';

// Connect using the connection string
MongoClient.connect(
  `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${
    process.env.MONGO_HOST
  }:${process.env.MONGO_PORT}/${process.env.MONGO_DATABASE}`,
  { useNewUrlParser: true },
  (err, client) => {
    const autoDb = client.db(process.env.MONGO_DATABASE);
    const averageScore: AggregationCursor<any> = autoDb
      .collection('reviews')
      .aggregate([
        { $match: { segmentation: 'W2' } },
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$total_score' },
            count: { $sum: 1 },
          },
        },
      ]);

    averageScore
      .next()
      .then((result: { _id: null; averageScore: number; count: number }) => {
        console.log(result);
      });

    setTimeout(() => {
      client.close().then(() => {
        console.log('Mongo connection has been closed.');
      });
    }, 5000);
  },
);

const POSTS = [
  { car: 'Echo', manufacturer: 'Toyota' },
  { car: 'Optra', manufacturer: 'Chevrolet' },
  { car: 'Rio', manufacturer: 'Kia' },
];

const schema = buildASTSchema(gql`
  type Query {
    posts: [Post]
    post(id: ID!): Post
  }

  type Post {
    id: ID
    car: String
    manufacturer: String
  }

  type Mutation {
    submitPost(input: PostInput!): Post
  }

  input PostInput {
    id: ID
    car: String!
    manufacturer: String!
  }
`);

const mapPost = (post: {}, id: number) => post && { id, ...post };

const root = {
  post: ({ id }: any) => mapPost(POSTS[id], id),
  posts: () => POSTS.map(mapPost),
  submitPost: ({
    input: { id, car, manufacturer },
  }: {
    input: { id: number; car: string; manufacturer: string };
  }) => {
    const post = { car, manufacturer };
    let index = POSTS.length;

    if (id != null && id >= 0 && id < POSTS.length) {
      POSTS.splice(id, 1, post);
      index = id;
    } else {
      POSTS.push(post);
    }

    return mapPost(post, index);
  },
};

const app: express.Application = express();

app.use(helmet());
app.use(cors());
app.use(
  '/graphql',
  graphqlHTTP({
    graphiql: true,
    rootValue: root,
    schema,
  }),
);

// Serve the front end automotive application
const distPath: string = path.join(
  __dirname,
  '../../client-automotive',
  'build',
);
app.use(express.static(distPath));

const port: number = 4000;
app.listen(port);

/* tslint:disable */
console.log(`Running a GraphQL API server at localhost:${port}/graphql`);

