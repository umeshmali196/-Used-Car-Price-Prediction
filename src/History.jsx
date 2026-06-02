import { useEffect, useState } from "react";
import api from "./api";

function History() {
  const [data, setData] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function fetchHistory() {
      try {
        const res = await api.get("/history");
        if (isMounted) setData(res.data);
      } catch (err) {
        console.error(err);
      }
    }

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Prediction History</h2>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Year</th>
            <th>KM</th>
            <th>Company</th>
            <th>Fuel</th>
            <th>Price</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td>{item.year}</td>
              <td>{item.km}</td>
              <td>{item.company}</td>
              <td>{item.fuel}</td>
              <td>Rs. {item.predicted_price}</td>
              <td>{new Date(item.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default History;
