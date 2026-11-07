# Air fryer review insights

What unhappy air fryer owners complain about, from 1 and 2 star Amazon reviews (Amazon Reviews 2023, McAuley Lab, UC San Diego).

- **Data:** 235,605 reviews of 1,448 air fryers; 42,134 are 1 or 2 stars.
- **Method:** a 16-theme complaint taxonomy, a 150-review answer key (labels drafted by Claude, reviewed by me), and a model comparison: keyword rules 50%, gpt-oss-20b 80%, gpt-oss-120b 85% agreement. Batching 10 reviews per request cut tokens per review from 936 to 322 with no accuracy loss.
- **Results:** a stratified random sample labeled by gpt-oss-120b, weighted back to the real product mix.

## Files
- `index.html` and `insights.js`: the page. All charts are computed in the browser from the CSV files.
- `data/labeled_sample.csv`, `data/type_stats.csv`: the data.
- `api/label.js`: a Vercel serverless function for the live "Label a new review" box. Needs the `GROQ_API_KEY` environment variable.

## Update the data
Replace `data/labeled_sample.csv` with the latest `step4_labeled_sample.csv` from the labeling notebook. No code changes needed.

Built by Saloni Tanpure. Code written with Claude.
