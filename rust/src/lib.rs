use wasm_bindgen::prelude::*;
use std::collections::HashSet;

#[derive(Clone, Debug)]
enum AST {
    Var(String),
    App(Box<AST>, Box<AST>),
    Lambda { param: String, body: Box<AST> },
}

fn free_vars(ast: &AST) -> HashSet<String> {
    match ast {
        AST::Var(name) => {
            let mut set = HashSet::new();
            set.insert(name.clone());
            set
        }
        AST::Lambda { param, body } => {
            let mut set = free_vars(body);
            set.remove(param);
            set
        }
        AST::App(left, right) => {
            let mut set = free_vars(left);
            set.extend(free_vars(right));
            set
        }
    }
}

fn fresh_var(existing: &HashSet<String>, base: &str) -> String {
    let mut new_var = base.to_string();
    let mut counter = 1;
    while existing.contains(&new_var) {
        new_var = format!("{}{}", base, counter);
        counter += 1;
    }
    new_var
}

fn substitute(ast: &AST, variable: &str, replacement: &AST) -> AST {
    match ast {
        AST::Var(name) => {
            if name == variable {
                replacement.clone()
            } else {
                ast.clone()
            }
        }
        AST::App(left, right) => AST::App(
            Box::new(substitute(left, variable, replacement)),
            Box::new(substitute(right, variable, replacement)),
        ),
        AST::Lambda { param, body } => {
            if param == variable {
                ast.clone()
            } else {
                let replacement_free = free_vars(replacement);
                if replacement_free.contains(param) {
                    let body_free = free_vars(body);
                    let all_free: HashSet<String> =
                        replacement_free.union(&body_free).cloned().collect();
                    let new_param = fresh_var(&all_free, param);
                    let renamed_body = substitute(body, param, &AST::Var(new_param.clone()));
                    AST::Lambda {
                        param: new_param,
                        body: Box::new(substitute(&renamed_body, variable, replacement)),
                    }
                } else {
                    AST::Lambda {
                        param: param.clone(),
                        body: Box::new(substitute(body, variable, replacement)),
                    }
                }
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Lambda,
    Dot,
    LParen,
    RParen,
    Identifier(String),
}

fn tokenize(input: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut chars = input.chars().peekable();
    while let Some(&c) = chars.peek() {
        if c.is_whitespace() {
            chars.next();
        } else if c == '(' {
            tokens.push(Token::LParen);
            chars.next();
        } else if c == ')' {
            tokens.push(Token::RParen);
            chars.next();
        } else if c == '.' {
            tokens.push(Token::Dot);
            chars.next();
        } else if c == '\\' || c == 'λ' {
            tokens.push(Token::Lambda);
            chars.next();
        } else if c.is_alphanumeric() || c == '_' {
            let mut ident = String::new();
            while let Some(&ch) = chars.peek() {
                if ch.is_alphanumeric() || ch == '_' {
                    ident.push(ch);
                    chars.next();
                } else {
                    break;
                }
            }
            tokens.push(Token::Identifier(ident));
        } else {
            // Skip any unknown characters.
            chars.next();
        }
    }
    tokens
}

struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Parser { tokens, pos: 0 }
    }

    // Peek returns a reference to the next token.
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    // next returns an owned token (cloned) so that no mutable borrow lingers.
    fn next(&mut self) -> Option<Token> {
        let tok = self.tokens.get(self.pos).cloned();
        self.pos += 1;
        tok
    }

    // Parse a factor: variable, lambda abstraction, or a parenthesized expression.
    fn parse_factor(&mut self) -> Result<AST, String> {
        let token = self.next();
        match token {
            Some(Token::Identifier(name)) => Ok(AST::Var(name)),
            Some(Token::Lambda) => {
                let param_token = self.next();
                if let Some(Token::Identifier(param)) = param_token {
                    let dot_token = self.next();
                    if let Some(Token::Dot) = dot_token {
                        let body = self.parse_application()?;
                        Ok(AST::Lambda {
                            param,
                            body: Box::new(body),
                        })
                    } else {
                        Err("Expected '.' after lambda parameter".into())
                    }
                } else {
                    Err("Expected identifier after lambda".into())
                }
            }
            Some(Token::LParen) => {
                let expr = self.parse_application()?;
                let closing_token = self.next();
                if let Some(Token::RParen) = closing_token {
                    Ok(expr)
                } else {
                    Err("Expected ')'".into())
                }
            }
            Some(tok) => Err(format!("Unexpected token: {:?}", tok)),
            None => Err("Unexpected end of input".into()),
        }
    }

    // Parse an application (left-associative).
    fn parse_application(&mut self) -> Result<AST, String> {
        let mut expr = self.parse_factor()?;
        while let Some(token) = self.peek() {
            match token {
                Token::Identifier(_) | Token::Lambda | Token::LParen => {
                    let next_factor = self.parse_factor()?;
                    expr = AST::App(Box::new(expr), Box::new(next_factor));
                }
                _ => break,
            }
        }
        Ok(expr)
    }
}

fn parse(tokens: Vec<Token>) -> Result<AST, String> {
    let mut parser = Parser::new(tokens);
    parser.parse_application()
}

fn beta_reduce(ast: &AST) -> (bool, AST) {
    match ast {
        AST::App(left, right) => {
            if let AST::Lambda { param, body } = &**left {
                // Redex: (λx. M) N  --> M[x := N]
                let reduced_ast = substitute(body, param, right);
                (true, reduced_ast)
            } else {
                let (reduced_left, new_left) = beta_reduce(left);
                if reduced_left {
                    (true, AST::App(Box::new(new_left), right.clone()))
                } else {
                    let (reduced_right, new_right) = beta_reduce(right);
                    if reduced_right {
                        (true, AST::App(left.clone(), Box::new(new_right)))
                    } else {
                        (false, ast.clone())
                    }
                }
            }
        }
        AST::Lambda { param, body } => {
            let (reduced_body, new_body) = beta_reduce(body);
            if reduced_body {
                (true, AST::Lambda {
                    param: param.clone(),
                    body: Box::new(new_body),
                })
            } else {
                (false, ast.clone())
            }
        }
        _ => (false, ast.clone()),
    }
}

fn ast_to_string(ast: &AST) -> String {
    match ast {
        AST::Var(name) => name.clone(),
        AST::Lambda { param, body } => format!("λ{}.{}", param, ast_to_string(body)),
        AST::App(left, right) => {
            let left_str = match **left {
                AST::Lambda { .. } => format!("({})", ast_to_string(left)),
                _ => ast_to_string(left),
            };
            let right_str = match **right {
                AST::Var(_) => ast_to_string(right),
                _ => format!("({})", ast_to_string(right)),
            };
            format!("{} {}", left_str, right_str)
        }
    }
}

fn next_beta_reduction_internal(input: &str) -> Result<String, String> {
    let tokens = tokenize(input);
    let ast = parse(tokens)?;
    let (_reduced, reduced_ast) = beta_reduce(&ast);
    Ok(ast_to_string(&reduced_ast))
}

#[wasm_bindgen]
pub fn next_beta_reduction_wasm(input: &str) -> String {
    next_beta_reduction_internal(input).unwrap_or_else(|e| e)
}
