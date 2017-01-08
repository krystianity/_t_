-- get an overview of valuable tweet's scores
SELECT topic,  SUM(score) AS score, SUM(comparative) AS comparative,
AVG(serious) AS serious,  AVG(manualRating) AS manual FROM tweets
WHERE createdAt BETWEEN '2017-01-08 14:00:00.000 +00:00' AND '2017-01-08 14:30:00.000 +00:00'
AND classifierRating = 1
GROUP BY topic;