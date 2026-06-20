// Минимальный помощник для тестов: сравнение через JSON и сводка.
let pass = 0, fail = 0;

export function eq(actual, expected, msg){
  if (JSON.stringify(actual) === JSON.stringify(expected)){
    pass++; console.log("  ok   " + msg);
  } else {
    fail++; console.log("  FAIL " + msg + "  =>  " + JSON.stringify(actual) + " != " + JSON.stringify(expected));
  }
}

export function ok(cond, msg){ eq(!!cond, true, msg); }

export function summary(){
  console.log("\n" + pass + " passed, " + fail + " failed");
  if (fail) process.exitCode = 1;
}
