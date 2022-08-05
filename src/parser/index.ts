import { isArray, orderBy, get, set, forEach, groupBy, first, toString, uniq } from "lodash";
import { Parser, Grammar } from "nearley";
import grammar from "../grammar/grammar";
import * as csv_parser from "csv-parse/sync";
import * as jsonata from "jsonata";
import { XMLParser } from "fast-xml-parser";
import { load as yaml_loader } from "js-yaml";
import { Command } from "../types";
import { summarize, get_value, get_extended_object, get_parse_csv_options, get_parse_xml_options } from "./utils";

const oqlGrammar = Grammar.fromCompiled(grammar);

const getAST = (input: string = "hello"): Promise<Command[]> => {
  const oqlParser = new Parser(oqlGrammar);
  oqlParser.feed(input.trim() || "hello");
  const commands = oqlParser.results;
  return new Promise((resolve, reject) => {
    if (commands.length === 0) {
      reject(`failed to parse query. no results found`);
    } else {
      resolve(commands[0]);
    }
  });
};

export const parse = (input: Command[], options?: { data?: any }): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    const data = options?.data || null;
    const result: { output: unknown; context: Record<string, unknown> } = input.reduce(
      (pv: { context: Record<string, unknown>; output: unknown }, cv: Command) => {
        switch (cv.type) {
          case "comment":
            return pv;
          case "hello":
            pv.output = "hello";
            return pv;
          case "ping":
          case "echo":
            pv.output = cv.value;
            return pv;
          case "scope":
            pv.output = get(pv.output, cv.value.value);
            return pv;
          case "jsonata":
            const expression = jsonata(cv.expression);
            let out = expression.evaluate(pv.output);
            if (out && typeof out === "object" && isArray(out)) {
              // https://github.com/jsonata-js/jsonata/issues/296
              delete (out as any).sequence;
            }
            pv.output = out;
            return pv;
          case "distinct":
            if (cv.value === undefined) {
              pv.output = uniq(pv.output as unknown[]);
            } else {
              if (typeof pv.output === "object" && isArray(pv.output) && cv.value) {
                let a = pv.output.map((o) => get(o, cv.value?.value || ""));
                pv.output = uniq(a);
              } else {
                let value = get(pv.output, cv.value.value);
                pv.output = uniq(value);
              }
            }
            return pv;
          case "mv-expand":
            if (typeof pv.output === "string") {
              return pv;
            } else if (typeof pv.output === "number") {
              return pv;
            } else if (isArray(pv.output)) {
              pv.output = pv.output
                .filter((item) => {
                  let v = get(item, cv.value.value);
                  return v && isArray(v) && v.length > 0;
                })
                .flatMap((item) => {
                  const expandingItem = get(item, cv.value.value);
                  if (expandingItem && isArray(expandingItem)) {
                    return expandingItem
                      .map((e) => {
                        return set({ ...item }, [cv.value.alias || cv.value.value], e);
                      })
                      .map((item) => {
                        if (cv.value.alias) {
                          delete item[cv.value.value];
                        }
                        return item;
                      });
                  }
                  return item;
                });
              return pv;
            } else {
              return pv;
            }
          case "count":
            if (typeof pv.output === "string") {
              pv.output = pv.output.length;
            } else if (typeof pv.output === "number") {
              pv.output = pv.output;
            } else if (isArray(pv.output)) {
              pv.output = pv.output.length;
            } else {
              pv.output = pv.output;
            }
            return pv;
          case "limit":
            if (typeof pv.output === "string") {
              pv.output = pv.output.substr(0, cv.value);
            } else if (typeof pv.output === "number") {
              pv.output = pv.output;
            } else if (isArray(pv.output)) {
              pv.output = pv.output.slice(0, cv.value);
            } else {
              pv.output = pv.output;
            }
            return pv;
          case "command":
            switch (cv.value.operator) {
              case "count":
                if (isArray(pv.output)) {
                  pv.output = get_value("count", pv.output);
                  return pv;
                }
                return pv;
              case "sum":
                if (isArray(pv.output)) {
                  pv.output = get_value("sum", pv.output);
                  return pv;
                }
                return pv;
              case "diff":
                if (isArray(pv.output) && pv.output.length === 2) {
                  pv.output = get_value("diff", pv.output);
                  return pv;
                }
                return pv;
              case "mul":
                if (isArray(pv.output) && pv.output.length === 2) {
                  pv.output = get_value("mul", pv.output);
                  return pv;
                }
                return pv;
              case "min":
                if (isArray(pv.output)) {
                  pv.output = get_value("min", pv.output);
                  return pv;
                }
                return pv;
              case "max":
                if (isArray(pv.output)) {
                  pv.output = get_value("max", pv.output);
                  return pv;
                }
                return pv;
              case "mean":
                if (isArray(pv.output)) {
                  pv.output = get_value("mean", pv.output);
                  return pv;
                }
                return pv;
              case "first":
                if (isArray(pv.output)) {
                  pv.output = get_value("first", pv.output);
                  return pv;
                }
                return pv;
              case "last":
                if (isArray(pv.output)) {
                  pv.output = get_value("last", pv.output);
                  return pv;
                }
                return pv;
              case "latest":
                if (isArray(pv.output)) {
                  pv.output = get_value("latest", pv.output);
                  return pv;
                }
                return pv;
              case "strcat":
                if (isArray(pv.output)) {
                  pv.output = get_value("strcat", pv.output);
                  return pv;
                }
                return pv;
              case "dcount":
                if (isArray(pv.output)) {
                  pv.output = get_value("dcount", pv.output);
                  return pv;
                }
                return pv;
              case "distinct":
                if (isArray(pv.output)) {
                  pv.output = get_value("distinct", pv.output);
                  return pv;
                }
                return pv;
              case "random":
                pv.output = get_value("random", []);
                return pv;
              case "toupper":
                if (typeof pv.output === "string") {
                  pv.output = get_value("toupper", [pv.output]);
                  return pv;
                }
                return pv;
              case "tolower":
                if (typeof pv.output === "string") {
                  pv.output = get_value("tolower", [pv.output]);
                  return pv;
                }
                return pv;
              case "strlen":
                if (typeof pv.output === "string") {
                  pv.output = get_value("strlen", [pv.output]);
                  return pv;
                }
                return pv;
              case "trim":
                if (typeof pv.output === "string") {
                  pv.output = get_value("trim", [pv.output]);
                  return pv;
                }
                return pv;
              case "trim_start":
                if (typeof pv.output === "string") {
                  pv.output = get_value("trim_start", [pv.output]);
                  return pv;
                }
                return pv;
              case "trim_end":
                if (typeof pv.output === "string") {
                  pv.output = get_value("trim_end", [pv.output]);
                  return pv;
                }
                return pv;
              default:
                return pv;
            }
          case "orderby":
            if (typeof pv.output === "string" || typeof pv.output === "number") {
              return pv;
            } else if (isArray(pv.output)) {
              pv.output = orderBy(
                pv.output as unknown[],
                cv.value.map((o) => o.field),
                cv.value.map((o) => o.direction || "asc")
              );
            }
            return pv;
          case "extend":
            if (typeof pv.output === "number" || typeof pv.output === "string" || !isArray(pv.output)) return pv;
            else if (isArray(pv.output)) {
              pv.output = pv.output.map((o) => {
                cv.value.forEach((ci) => {
                  if (ci.type === "function") {
                    o = get_extended_object(o, ci, pv.output);
                  } else if (ci.type === "ref") {
                    set(o, ci.alias || ci.value, get(o, ci.value));
                  }
                });
                return o;
              });
            }
            return pv;
          case "project":
            if (typeof pv.output === "number") {
              return pv;
            } else if (typeof pv.output === "string") {
              return pv;
            } else if (typeof pv.output === "object" && isArray(pv.output)) {
              let refs = cv.value.filter((v) => v.type === "ref");
              let functions = cv.value.filter((v) => v.type === "function");
              pv.output = pv.output.map((o) => {
                let oo = {};
                refs.forEach((r) => {
                  if (r.type === "ref") {
                    let key = r.alias || r.value;
                    set(oo, key, get(o, r.value));
                  }
                });
                functions.forEach((f) => {
                  if (f.type === "function") {
                    let key = f.alias || f.operator;
                    let args = f.args.map((arg) => {
                      if (arg.type === "ref") return get(o, arg.value);
                      else if (arg.type === "string") return arg.value;
                      else if (arg.type === "number") return +arg.value;
                    });
                    let value = get_value(f.operator, args);
                    set(oo, key, value);
                  }
                });
                return oo;
              });
              return pv;
            } else if (typeof pv.output === "object") {
              let refs = cv.value.filter((v) => v.type === "ref");
              let functions = cv.value.filter((v) => v.type === "function");
              let oo: Record<string, any> = {};
              let isSingle = cv.value.filter((v) => v.type === "ref" || v.type === "function").length === 1;
              refs.forEach((r) => {
                if (r.type === "ref") {
                  let key = r.alias || r.value;
                  set(oo, key, get(pv.output, r.value));
                }
              });
              functions.forEach((f) => {
                if (f.type === "function") {
                  let key = f.alias || f.operator;
                  let args = f.args.map((arg) => {
                    if (arg.type === "ref") return get(pv.output, arg.value);
                    else if (arg.type === "string") return arg.value;
                    else if (arg.type === "number") return +arg.value;
                  });
                  let value = get_value(f.operator, args, pv.output);
                  set(oo, key, value);
                }
              });
              if (isSingle && refs.length === 1 && refs[0].type === "ref") {
                pv.output = oo[refs[0].alias || refs[0].value];
              } else if (isSingle && functions.length === 1 && functions[0].type === "function") {
                pv.output = oo[functions[0].alias || functions[0].operator];
              } else {
                pv.output = oo;
              }
              return pv;
            } else {
              return pv;
            }
          case "project-away":
            if (typeof pv.output === "number" || typeof pv.output === "string" || !isArray(pv.output)) return pv;
            else if (isArray(pv.output)) {
              let keys = cv.value.map((c) => c.value || "");
              pv.output = pv.output.map((o) => {
                let oo = o;
                Object.keys(o).forEach((key) => {
                  if (keys.includes(key)) {
                    delete oo[key];
                  }
                });
                return oo;
              });
            }
            return pv;
          case "summarize":
            let item = cv.value;
            let groupByValues = item.by;
            if (groupByValues.length === 1) {
              const groupByKey = groupByValues[0].value;
              let groupedResult = groupBy(pv.output as unknown[], groupByKey);
              let o: unknown[] = [];
              forEach(groupedResult, (g, key) => {
                let s = summarize({}, item.metrics, g);
                o.push({ [groupByKey]: key, ...s });
              });
              pv.output = o;
            } else if (groupByValues.length > 1) {
              let groups = groupBy(pv.output as unknown[], (a: any) => {
                return item.by.map((g) => toString(a[g.value])).join("#___#");
              });
              let out: unknown[] = [];
              forEach(groups, (group) => {
                let o: Record<string, unknown> = {};
                item.by.forEach((gi) => {
                  o[gi.value] = (first(group) as any)?.[gi.value];
                });
                let s = summarize(o, item.metrics, group);
                out.push(s);
              });
              pv.output = out;
              return pv;
            } else {
              pv.output = summarize({}, item.metrics, pv.output as unknown[]);
            }
            return pv;
          case "parse-json":
            if (typeof pv.output === "string") {
              pv.output = JSON.parse(pv.output);
            }
            return pv;
          case "parse-csv":
            if (typeof pv.output === "string") {
              let csv_parser_options = get_parse_csv_options(cv.args);
              let result: string[][] = csv_parser.parse(pv.output, csv_parser_options);
              pv.output = result;
            }
            return pv;
          case "parse-xml":
            if (typeof pv.output === "string") {
              let xml_parser_options = get_parse_xml_options(cv.args);
              let parser = new XMLParser(xml_parser_options);
              pv.output = parser.parse(pv.output);
            }
            return pv;
          case "parse-yaml":
            if (typeof pv.output === "string") {
              try {
                let parser = yaml_loader(pv.output);
                pv.output = parser;
              } catch (ex) {
                throw ex;
              }
            }
            return pv;
          default:
            return pv;
        }
      },
      { context: {}, output: data }
    );
    resolve(result.output);
  });
};

export const uql = (query: string, options?: { data?: any }): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    if (!query) {
      resolve("hello there! provide a valid query");
    } else {
      getAST(query)
        .then((res) => {
          parse(res, options)
            .then((result) => resolve(result))
            .catch((ex) => reject(ex));
        })
        .catch((ex) => reject(ex));
    }
  });
};
