// Kiểm tra các món và danh mục
MATCH (f:Food)-[:BELONGS_TO]->(c:Category)
RETURN f.name, f.price, c.name
ORDER BY c.name, f.name;

// Món khách hàng đã gọi nhiều nhất
MATCH (c:Customer)-[r:ORDERED]->(f:Food)
RETURN c.name, f.name, r.count
ORDER BY r.count DESC;

// Gợi ý cộng tác: người có cùng món yêu thích còn gọi món nào khác
MATCH (me:Customer {id: $userId})-[:ORDERED|REVIEWED]->(liked:Food)
MATCH (other:Customer)-[:ORDERED|REVIEWED]->(liked)
WHERE other <> me
MATCH (other)-[:ORDERED|REVIEWED]->(candidate:Food)
WHERE NOT (me)-[:ORDERED|REVIEWED]->(candidate)
RETURN candidate.name, count(DISTINCT other) AS score
ORDER BY score DESC
LIMIT 8;

