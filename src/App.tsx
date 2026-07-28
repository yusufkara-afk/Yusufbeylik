import { useState } from "react";

function App(): JSX.Element {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <h1>Hello from Yusufbeylik</h1>
      <p>
        <button onClick={() => setCount((c) => c + 1)}>count is: {count}</button>
      </p>
    </div>
  );
}

export default App;
