const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

/*const getLikes = async (tweetId) => {
  const lq = `SELECT count(*)AS cl FROM like WHERE tweet_id=11
  ;`;
  l = await db.all(lq);
  console.log(l);
  return l;
};

const getReplies = async (tweetId) => {
  const rq = `
  SELECT count(*)AS cr FROM like WHERE tweet_id=1
  ;`;
  r = await db.all(rq);
  console.log(r);
  return r;
};*/

//get userid
const getuserid = async (username) => {
  const userIdQ = `SELECT user_id FROM user WHERE username = "${username}";`;
  userObj = await db.get(userIdQ);
  return userObj.user_id;
};

// userids of people who follows the user
const getFollowingIds = async (username) => {
  const getFollowingIdsQuery = `
    SELECT following_user_id
    FROM follower INNER JOIN user ON follower.follower_user_id=user.user_id
    WHERE user.username='${username}';`;
  const followingIds = await db.all(getFollowingIdsQuery);
  const arrayOfIds = followingIds.map((eachUser) => eachUser.following_user_id);
  return arrayOfIds;
};
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.userId = payload.userId;
        next();
      }
    });
  }
};
//
const tweetAV = async (request, response, next) => {
  //console.log("tweetAV");
  const { username } = request;
  userId = await getuserid(username);
  const { tweetId } = request.params;
  console.log(tweetId);
  const getTweetQuery = `SELECT *
    FROM tweet INNER JOIN follower ON tweet.user_id=following_user_id
    WHERE tweet.tweet_id=${tweetId} AND follower_user_id=${userId};`;
  const tweet = await db.get(getTweetQuery);
  console.log(tweet);
  if (tweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    next();
  }
};
//API 1
app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  console.log(dbUser);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}'
        )`;
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;

      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});
//API 2
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  userId = await getuserid(username);
  console.log(userId);
  //followingPeopleIds = await getFollowingIds(username);
  /* const checkQuery=`SELECT * 
  FROM tweet JOIN follower ON tweet.user_id=follower.following_user_id
  WHERE tweet.user_id=S{userId};`;
  const checkResult= await db.all(checkQuery);
  console.log(checkResult);*/
  const tweetsQ = `
 SELECT
   username,
  tweet,
  date_time AS dateTime
FROM
  (user INNER JOIN tweet ON user.user_id=tweet.user_id) AS T INNER JOIN follower ON T.user_id=follower.following_user_id
WHERE 
    follower.follower_user_id = ${userId}
ORDER BY
  date_time DESC
LIMIT 4`;
  const feed = await db.all(tweetsQ);
  console.log(feed);
  response.send(feed);
});

//API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  console.log("a4");
  const { username } = request;
  userId = await getuserid(username);
  console.log(userId);
  const getData = `
    SELECT
      name
    FROM
      user INNER JOIN follower ON user.user_id = follower.following_user_id
    WHERE 
        follower.follower_user_id=${userId};`;
  const r = await db.all(getData);
  response.send(r);
  /*const q = `
  SELECT * FROM follower JOIN user ON follower.follower_user_id=user.user_id WHERE follower_user_id=2
  ;`;
  d = await db.all(q);
  //console.log(c);
  response.send(d);*/
});
//API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  console.log("a5");
  const { username } = request;
  userId = await getuserid(username);
  const getD = `
    SELECT
      DISTINCT name
    FROM
      user INNER JOIN follower  ON user.user_id= follower.follower_user_id
    WHERE
        following_user_id=${userId}`;
  const r = await db.all(getD);
  response.send(r);
});
//API 6
app.get(
  "/tweets/:tweetId/",
  authenticateToken,
  tweetAV,
  async (request, response) => {
    console.log("a6");
    const { username } = request;
    userId = await getuserid(username);
    const { tweetId } = request.params;
    const getD = `
    SELECT
      tweet,
      (SELECT COUNT() FROM like WHERE tweet_id='${tweetId}') AS likes,
      (SELECT COUNT() FROM reply  WHERE tweet_id='${tweetId}') AS replies,
      date_time AS dateTime
    FROM
      tweet
     WHERE 
        tweet.tweet_id='${tweetId}';`;
    const r = await db.get(getD);
    response.send(r);
    console.log(r);
  }
);
//API 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  tweetAV,
  async (request, response) => {
    console.log("a7");
    const { tweetId } = request.params;
    const likesQ = `
        SELECT username
        FROM user INNER JOIN like ON user.user_id=like.user_id
        WHERE tweet_id='${tweetId}';`;
    const likesR = await db.all(likesQ);
    console.log(likesR);
    const usersArray = likesR.map((eachUser) => eachUser.username);
    response.send({ likes: usersArray });
  }
);
//API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  tweetAV,
  async (request, response) => {
    console.log("a8");
    const { tweetId } = request.params;
    const getD = `
    SELECT
      name,reply
    FROM
      user INNER JOIN reply ON user.user_id=reply.user_id
    WHERE 
        tweet_id='${tweetId}';`;
    const r = await db.all(getD);
    console.log(r);
    response.send({ replies: r });
  }
);
//API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  console.log("a9");
  const { username } = request;
  userId = await getuserid(username);
  const getD = `
    SELECT
    tweet,
    COUNT(DISTINCT like_id) AS likes,
    COUNT(DISTINCT reply_id) AS replies,
    date_time AS dateTime
    FROM tweet LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id 
    LEFT JOIN like ON tweet.tweet_id = like.tweet_id
    WHERE tweet.user_id = ${userId}
    GROUP BY tweet.tweet_id;`;
  /*const getD = `SELECT * FROM tweet WHERE user_id=2;`;*/
  const r = await db.all(getD);
  response.send(r);
});
//API 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const postTweetQuery = `
  INSERT INTO
    tweet (tweet)
  VALUES
    ('${tweet}')`;
  await db.run(postTweetQuery);
  response.send("Created a Tweet");
});
//API 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    console.log("a11");
    const { tweetId } = request.params;
    const { username } = request;
    userId = await getuserid(username);
    const tweetBelongsToUserCheckQuery = `SELECT * FROM tweet 
    WHERE user_id = '${userId}' AND tweet_id = ${tweetId};`;
    const result = await db.get(tweetBelongsToUserCheckQuery);
    console.log(result);
    if (result === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweetQuery = `
        DELETE FROM tweet
        WHERE tweet_id = '${tweetId}';`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
