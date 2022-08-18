import axios from "axios";
import express from "express";
import config from "./config";
const PORT = 3001;
const app = express();

app.get("/", (req, res) => {
  res.status(200).send("Hello World");
});

app.get("/countries", async (req, res) => {
  try {
    const response = await axios.get(
      "https://smspool.net/api/country/retrieve_all"
    );

    res.status(200).send(response.data);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
});

app.get("/services", async (req, res) => {
  try {
    const response = await axios.get(
      "https://smspool.net/api/service/retrieve_all"
    );

    res.status(200).send(response.data);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get("/purchase", async (req, res) => {
  const { country, service } = req.query;

  // TODO: validate that the lightning payment has been sent! :)

  if (!country) {
    res.status(400).send({ error: "Missing country id" });
  } else if (!service) {
    res.status(400).send({ error: "Missing service id" });
  }

  try {
    const response = await axios.get(
      `https://smspool.net/api/purchase/sms?key=${config.smspoolApiKey}&country=${country}&service=${service}`
    );

    res.status(200).send(response.data);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get("/check", async (req, res) => {
  const { orderid } = req.query;

  if (!orderid) {
    res.status(400).send({ error: "Missing order id" });
  }

  try {
    const response = await axios.get(
      `https://smspool.net/api/sms/check?key=${config.smspoolApiKey}&orderid=${orderid}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    res.status(200).send(response.data);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
